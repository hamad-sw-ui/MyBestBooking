import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Test d'intégration — T-150 : notification email de nouveau message.
 *
 * Garantit côté route POST /api/messages :
 * - destinataire correct dans les deux sens (voyageur → hôte, hôte → voyageur) ;
 * - langue du DESTINATAIRE : un voyageur `language=en` reçoit un e-mail
 *   anglais, un hôte francophone un e-mail français ;
 * - le CTA pointe vers la bonne section (`/messages/[conv]` voyageur,
 *   `/dashboard/messages/[conv]` hôte).
 * Skip automatique si la DB n'est pas accessible. Ne modifie que les lignes
 * créées puis nettoyées ici.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const c = await pool.connect();
  await c.query("SELECT 1");
  c.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

dbTest("T-150 — POST /api/messages → email du destinataire localisé + CTA", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: (typeof import("@/lib/auth"))["getCurrentUser"];
  let hostId = "";
  let guestId = "";
  let propId = "";
  let roomId = "";
  let convId = "";
  const messageIds: string[] = [];
  const outboxKeys: string[] = [];

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const { generateSlug } = await import("@/lib/utils");
    const { clearSettingsCache } = await import("@/lib/settings");
    clearSettingsCache();

    const [host] = await db
      .insert(schema.users)
      .values({
        email: `host-msg-t150-${Date.now()}@test.local`,
        firstName: "Paul",
        lastName: "Host",
        role: "host",
        language: "fr",
      })
      .returning();
    hostId = host.id;

    const [guest] = await db
      .insert(schema.users)
      .values({
        email: `guest-msg-t150-${Date.now()}@test.local`,
        firstName: "Marie",
        lastName: "Guest",
        language: "en",
      })
      .returning();
    guestId = guest.id;

    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-150 Messages Property",
        slug: generateSlug(`t150-msg-${Date.now()}`),
        type: "hotel",
        city: "Douala",
        country: "CM",
        status: "active",
      })
      .returning();
    propId = prop.id;

    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-150 Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        quantity: 1,
        isActive: true,
      })
      .returning({ id: schema.rooms.id });
    roomId = room.id;

    const [conv] = await db
      .insert(schema.conversations)
      .values({
        conversationKey: `t150-msg-${Date.now()}`,
        propertyId: prop.id,
        userId: guestId,
      })
      .returning();
    convId = conv.id;
  });

  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    if (outboxKeys.length) {
      await db.delete(schema.emailOutbox).where(inArray(schema.emailOutbox.eventKey, outboxKeys));
    }
    if (messageIds.length) {
      await db.delete(schema.messages).where(inArray(schema.messages.id, messageIds));
    }
    if (convId) {
      await db.delete(schema.conversations).where(eq(schema.conversations.id, convId));
    }
    if (roomId) {
      await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    }
    if (propId) {
      await db.delete(schema.properties).where(eq(schema.properties.id, propId));
    }
    if (hostId) {
      await db.delete(schema.users).where(eq(schema.users.id, hostId));
    }
    if (guestId) {
      await db.delete(schema.users).where(eq(schema.users.id, guestId));
    }
  });

  async function postMessage(content: string) {
    const req = new Request(`http://localhost/api/messages?conversationId=${convId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId: convId, content }),
    });
    const res = await POST(req as never);
    const body = (await res.json()) as { message?: { id: string } };
    if (body.message?.id) messageIds.push(body.message.id);
    return { res, body };
  }

  it("voyageur → hôte : e-mail FR pour l'hôte + CTA /dashboard/messages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: guestId, firstName: "Marie", lastName: "Guest", email: `guest-msg-t150-${Date.now()}@test.local`,
      role: "customer", language: "en",
    } as never);

    const { res, body } = await postMessage("Bonjour, la chambre est-elle dispo ?");
    expect(res.status).toBe(201);
    const msgId = body.message!.id;
    const hostKey = `message:${msgId}:${hostId}`;
    outboxKeys.push(hostKey);

    const [row] = await db
      .select()
      .from(schema.emailOutbox)
      .where((await import("drizzle-orm")).eq(schema.emailOutbox.eventKey, hostKey))
      .limit(1);
    expect(row).toBeDefined();
    const [hostUser] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where((await import("drizzle-orm")).eq(schema.users.id, hostId))
      .limit(1);
    expect(row.to).toBe(hostUser?.email);
    // Hôte francophone → habillage + sujet/corps FR.
    expect(row.subject).toBe("Nouveau message de Marie Guest");
    expect(row.html).toContain("Répondre au message");
    expect(row.html).toContain("Réservez mieux");
    // CTA = section dashboard (destinataire = hôte), jamais la section voyageur.
    expect(row.html).toContain(`/dashboard/messages/${convId}`);
    expect(row.html).not.toContain(`href="http://localhost:3000/messages/${convId}"`);
  });

  it("hôte → voyageur : e-mail EN pour la voyageuse + CTA /messages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: hostId, firstName: "Paul", lastName: "Host", email: `host-msg-t150-${Date.now()}@test.local`,
      role: "host", language: "fr",
    } as never);

    const { res, body } = await postMessage("Oui, la chambre est disponible.");
    expect(res.status).toBe(201);
    const msgId = body.message!.id;
    const guestKey = `message:${msgId}:${guestId}`;
    outboxKeys.push(guestKey);

    const [row] = await db
      .select()
      .from(schema.emailOutbox)
      .where((await import("drizzle-orm")).eq(schema.emailOutbox.eventKey, guestKey))
      .limit(1);
    expect(row).toBeDefined();
    const [guestUser] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where((await import("drizzle-orm")).eq(schema.users.id, guestId))
      .limit(1);
    expect(row.to).toBe(guestUser?.email);
    // Voyageuse anglophone → sujet/corps/bouton EN.
    expect(row.subject).toBe("New message from Paul Host");
    expect(row.html).toContain("Reply to the message");
    expect(row.html).toContain("You have received a new message from Paul Host");
    expect(row.html).toContain("Book better. Travel further.");
    // CTA = section voyageur.
    expect(row.html).toContain(`/messages/${convId}`);
    expect(row.html).not.toContain("/dashboard/messages/");
  });
});
