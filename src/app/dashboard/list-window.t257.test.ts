import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * T-257 (audit n°6, B4) — les deux derniers écrans de liste sans fenêtre.
 *
 * Constat : `parsePageWindow` + `<ShowMore>` couvraient 7 écrans (T-245) mais
 * `/dashboard/rooms` et `/dashboard/messages` chargeaient **tout** — et la
 * branche hôte de `/dashboard/rooms` faisait une requête **par bien** (N+1).
 *
 * Ce test verrouille, sur la vraie base :
 *   1. `/dashboard/rooms` sert la liste complète des chambres des biens de
 *      l'hôte (équivalent exact de la boucle remplacée) et reste silencieux tant
 *      que la fenêtre suffit ;
 *   2. au-delà de 25 lignes, la fenêtre borne réellement et le bandeau annonce
 *      « N sur M » avec les liens d'élargissement — pour les chambres ;
 *   3. idem pour les conversations de l'hôte.
 *
 * Données de test créées puis supprimées (3 chambres, 26 fils + messages).
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const connection = await pool.connect();
  await connection.query("SELECT 1");
  connection.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

// `src/lib/server-locale.ts` importe `server-only` (hors composant serveur en
// vitest) et les pages lisent la session : les deux sont neutralisés.
vi.mock("server-only", () => ({}));
// Les managers clients utilisent le routeur applicatif (rafraîchissement après
// action groupée) : hors requête Next, il faut le neutraliser.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/rooms",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: getHostId(), role: "host", email: "host@mybestbooking.com" })),
}));

let hostId = "";
let hostPropertyIds: string[] = [];
const createdRoomIds: string[] = [];
const createdConversationIds: string[] = [];

function getHostId(): string {
  return hostId;
}

beforeAll(async () => {
  if (!dbAvailable) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [host] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "host@mybestbooking.com"));
  hostId = host!.id;
  hostPropertyIds = (
    await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId))
  ).map((row) => row.id);
});

afterAll(async () => {
  if (!dbAvailable) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { inArray } = await import("drizzle-orm");
  if (createdRoomIds.length) {
    await db.delete(schema.rooms).where(inArray(schema.rooms.id, createdRoomIds));
    createdRoomIds.length = 0;
  }
  if (createdConversationIds.length) {
    await db.delete(schema.messages).where(inArray(schema.messages.conversationId, createdConversationIds));
    await db.delete(schema.conversations).where(inArray(schema.conversations.id, createdConversationIds));
    createdConversationIds.length = 0;
  }
});

dbTest("T-257 — /dashboard/rooms : une requête pour toutes les chambres de l'hôte", () => {
  it("sert la liste complète (jointure) et n'affiche aucun bandeau tant qu'elle tient dans la fenêtre", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    const hostRooms = hostPropertyIds.length
      ? await db
          .select({ id: schema.rooms.id, name: schema.rooms.name })
          .from(schema.rooms)
          .where(inArray(schema.rooms.propertyId, hostPropertyIds))
      : [];

    const page = (await import("./rooms/page")).default;
    const html = renderToStaticMarkup(
      (await page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
    );

    expect(hostRooms.length).toBeGreaterThan(0);
    // La première ET la dernière du tri `createdAt desc` sont rendues : la
    // jointure ne perd aucune chambre des biens de l'hôte.
    expect(html).toContain(hostRooms[0]!.name);
    expect(html).toContain(hostRooms[hostRooms.length - 1]!.name);
    if (hostRooms.length <= 25) expect(html).not.toContain("data-testid=\"show-more\"");
  });

  it("au-delà de 25 chambres, la fenêtre borne et le bandeau propose d'élargir", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    const propertyId = hostPropertyIds[0]!;
    // Le seed est aléatoire (2–4 chambres par bien) : on compte les chambres
    // existantes de l'hôte plutôt que d'en coder un total en dur.
    const existing = await db
      .select({ id: schema.rooms.id })
      .from(schema.rooms)
      .where(inArray(schema.rooms.propertyId, hostPropertyIds));
    for (let index = 0; index < 3; index += 1) {
      const [room] = await db
        .insert(schema.rooms)
        .values({
          propertyId,
          name: `T257 Chambre ${index}`,
          roomType: "double",
          maxOccupancy: 2,
          maxAdults: 2,
          quantity: 1,
          basePrice: "50.00",
          currency: "EUR",
        })
        .returning({ id: schema.rooms.id });
      createdRoomIds.push(room!.id);
    }

    const page = (await import("./rooms/page")).default;
    const html = renderToStaticMarkup(
      (await page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
    );

    const total = existing.length + 3;
    expect(total).toBeGreaterThan(25); // précondition : la fenêtre doit mordre
    expect(html).toContain(`25 résultats affichés sur ${total}`);
    expect(html).toContain("limit=50");
    expect(html).toContain(`Tout afficher (${total})`);
  });
});

dbTest("T-257 — /dashboard/messages : la fenêtre s'applique aux conversations", () => {
  it("au-delà de 25 fils, la fenêtre borne et le bandeau propose d'élargir", async () => {
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const propertyId = hostPropertyIds[0]!;
    for (let index = 0; index < 26; index += 1) {
      const [conversation] = await db
        .insert(schema.conversations)
        .values({
          conversationKey: `t257-${Date.now()}-${index}`,
          userId: hostId,
          propertyId,
          lastMessageAt: new Date(Date.now() - index * 1000),
          unreadByHost: 0,
        })
        .returning({ id: schema.conversations.id });
      createdConversationIds.push(conversation!.id);
      await db.insert(schema.messages).values({
        conversationId: conversation!.id,
        senderId: hostId,
        senderType: "host",
        content: `message ${index}`,
      });
    }

    const page = (await import("./messages/page")).default;
    const html = renderToStaticMarkup(
      (await page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
    );

    expect(html).toContain("25 résultats affichés sur 26");
    expect(html).toContain("limit=50");
    expect(html).toContain("Tout afficher (26)");
  });
});
