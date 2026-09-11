import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * T-270 (audit n°7, C6) — la boîte de réception `/messages` (client) était
 * l'écran le plus coûteux de la fenêtre T-245 : **une requête par fil** pour
 * le dernier message (1 + N) et aucun bornage du chargement.
 *
 * Corrections verrouillées ici, sur la vraie base :
 *   1. le dernier message des fils de la fenêtre est chargé en UNE requête
 *      (compteur de requêtes SQL : le `SELECT ... FROM messages` n'apparaît
 *      qu'une fois pour un rendu complet) ;
 *   2. la fenêtre borne le chargement (25 par défaut, « Afficher 25 de plus »,
 *      « Tout afficher (N) ») ;
 *   3. le compteur du bandeau applique la MÊME condition de visibilité que la
 *      liste (fil vide de plus de 7 jours : ni affiché, ni compté — le
 *      bandeau ne peut pas mentir, contrat T-257).
 *
 * Données de test créées puis supprimées (30 fils + 5 fils vides anciens).
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
// vitest) et la page lit la session : les deux sont neutralisés.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect: ${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({ id: getCustomerId(), role: "customer", email: "customer@mybestbooking.com" })),
}));

let customerId = "";
let hostId = "";
let propertyId = "";
const createdConversationIds: string[] = [];

function getCustomerId(): string {
  return customerId;
}

beforeAll(async () => {
  if (!dbAvailable) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [customer] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "customer@mybestbooking.com"));
  customerId = customer!.id;
  const [host] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "host@mybestbooking.com"));
  hostId = host!.id;
  const [property] = await db
    .select({ id: schema.properties.id, hostId: schema.properties.hostId })
    .from(schema.properties)
    .where(eq(schema.properties.hostId, hostId));
  propertyId = property!.id;
});

afterAll(async () => {
  if (!dbAvailable) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { inArray } = await import("drizzle-orm");
  if (createdConversationIds.length) {
    await db.delete(schema.messages).where(inArray(schema.messages.conversationId, createdConversationIds));
    await db.delete(schema.conversations).where(inArray(schema.conversations.id, createdConversationIds));
    createdConversationIds.length = 0;
  }
});

async function makeConversation(index: number, { message = true, ageDays = 0 } = {}) {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const [conversation] = await db
    .insert(schema.conversations)
    .values({
      conversationKey: `t270-${Date.now()}-${index}`,
      userId: customerId,
      propertyId,
      lastMessageAt: new Date(Date.now() - index * 1000 - ageDays * 86400000),
      unreadByHost: 0,
      createdAt: ageDays ? new Date(Date.now() - ageDays * 86400000) : undefined,
    })
    .returning({ id: schema.conversations.id });
  createdConversationIds.push(conversation!.id);
  if (message) {
    await db.insert(schema.messages).values({
      conversationId: conversation!.id,
      senderId: hostId,
      senderType: "host",
      content: `T270 message ${index}`,
    });
  }
  return conversation!.id;
}

dbTest("T-270 — /messages : fenêtre + dernier message en une seule requête", () => {
  it("30 fils → 25 affichés, bandeau « sur 30 », liens d'élargissement", async () => {
    for (let index = 0; index < 30; index += 1) {
      await makeConversation(index);
    }

    const page = (await import("./page")).default;
    const html = renderToStaticMarkup(
      (await page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
    );

    expect(html).toContain("25 résultats affichés sur 30");
    expect(html).toContain("limit=50");
    expect(html).toContain("Tout afficher (30)");
  });

  it("?limit=100 affiche les 30 fils et retire le bandeau", async () => {
    const page = (await import("./page")).default;
    const html = renderToStaticMarkup(
      (await page({ searchParams: Promise.resolve({ limit: "100" }) })) as React.ReactElement,
    );

    expect(html).not.toContain("data-testid=\"show-more\"");
    // Le fil le plus ancien des 30 créés (message index 29) est rendu :
    // aucune ligne visible n'est perdue.
    expect(html).toContain("T270 message 29");
  });

  it("le dernier message des fils de la fenêtre est chargé en UNE requête", async () => {
    const { pool } = await import("@/db");
    const originalQuery = pool.query.bind(pool);
    const seen: string[] = [];
    // Drizzle appelle `pool.query(configObj, values)` avec `configObj.text`
    // (pas une chaîne nue) : on extrait le texte dans les deux formes.
    vi.spyOn(pool, "query").mockImplementation(((sql: string | { text: string }, values?: unknown[]) => {
      seen.push(typeof sql === "string" ? sql : sql.text);
      return values === undefined ? originalQuery(sql as string) : originalQuery(sql as string, values);
    }) as unknown as typeof pool.query);

    try {
      const page = (await import("./page")).default;
      renderToStaticMarkup(
        (await page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
      );
    } finally {
      vi.restoreAllMocks();
    }

    // Drizzle quote les identifiants : `from "messages"`.
    const fromMessages = seen.filter((sql) => /\bfrom\s+"?messages"?\b/i.test(sql));
    // L'ancienne forme N+1 — une requête par fil
    // (`... from "messages" where "messages"."conversation_id" = $1 ...`) —
    // est proscrite. Les sous-requêtes EXISTS de visibilité ne rentrent pas
    // dans ce motif (elles comparent à `"conversations".id`, pas à un `$N`).
    const perConversation = fromMessages.filter((sql) =>
      /"messages"\."conversation_id"\s*=\s*\$[0-9]+/i.test(sql),
    );
    expect(perConversation.length).toBe(0);
    // Et les 25 derniers messages voyagent dans UNE requête IN-liste.
    const batched = fromMessages.filter((sql) => /\bin\s*\(\s*\$[0-9]/i.test(sql));
    expect(batched.length).toBe(1);
    expect(batched[0]).toMatch(/\$[0-9]+/);
  });

  it("un fil vide de +7 jours n'est ni affiché ni compté (même condition)", async () => {
    for (let index = 0; index < 5; index += 1) {
      await makeConversation(100 + index, { message: false, ageDays: 30 });
    }

    const page = (await import("./page")).default;
    const html = renderToStaticMarkup(
      (await page({ searchParams: Promise.resolve({}) })) as React.ReactElement,
    );

    // Total = 30 fils avec message + 1 fil vide récent éventuel du seed… le
    // total ne compte PAS les 5 fils vides anciens : on l'attend exact.
    expect(html).toContain("25 résultats affichés sur 30");
    expect(html).not.toContain("sur 35");
  });
});


