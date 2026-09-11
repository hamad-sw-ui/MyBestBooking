import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-237 (audit n°3, F6) — validation/rejet d'annonce enfin notifié.
 *
 * Constat d'audit : `/api/properties/[id]/validate` écrivait le motif dans
 * `audit_log` uniquement — aucun e-mail, aucune colonne motif. L'hôte voyait
 * son annonce repasser en `draft` sans explication, et n'était pas prévenu de
 * la mise en ligne.
 *
 * Contrat vérifié ici :
 *   1. un rejet persiste le motif (`properties.review_reason`) et met l'annonce
 *      en brouillon ;
 *   2. l'hôte reçoit un e-mail **une seule fois** par décision (`eventKey`
 *      déterministe, rejeu idempotent) ;
 *   3. l'approbation efface le motif et notifie la mise en ligne ;
 *   4. les interrupteurs admin coupent les envois sans changer la décision.
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

dbTest("T-237 — décision de validation d'annonce notifiée à l'hôte", () => {
  let POST: (req: unknown, ctx: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let adminId = "";
  let hostId = "";
  let propertyId = "";
  let initialStatus: string | null = null;
  let adminEmail = "";

  async function decide(action: "approve" | "reject" | "suspend", reason?: string) {
    const { NextRequest } = await import("next/server");
    const request = new NextRequest("http://localhost/api/properties/x/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
    });
    return POST(request, { params: Promise.resolve({ id: propertyId }) });
  }

  async function setNotifications(patch: Record<string, boolean>) {
    const { getSetting, setSetting } = await import("@/lib/settings");
    const current = await getSetting("notifications");
    await setSetting("notifications", { ...current, ...patch }, adminId);
  }

  async function outboxEvents(prefix: string) {
    const { and, like } = await import("drizzle-orm");
    return db
      .select({ eventKey: schema.emailOutbox.eventKey, to: schema.emailOutbox.to })
      .from(schema.emailOutbox)
      .where(and(like(schema.emailOutbox.eventKey, `${prefix}%`)));
  }

  beforeAll(async () => {
    POST = (await import("./route")).POST as unknown as typeof POST;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    getCurrentUser = (await import("@/lib/auth")).getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [admin] = await db.select().from(schema.users).where(eq(schema.users.role, "admin")).limit(1);
    adminId = admin.id;
    adminEmail = admin.email;
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", email: adminEmail });

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    hostId = host.id;
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId))
      .limit(1);
    propertyId = property.id;
    initialStatus = property.status;
  });

  afterAll(async () => {
    if (!db) return;
    const { eq, like } = await import("drizzle-orm");
    await db.delete(schema.emailOutbox).where(like(schema.emailOutbox.eventKey, `property-decision:${propertyId}%`));
    await db
      .update(schema.properties)
      .set({ status: initialStatus, reviewReason: null, validatedAt: null, validatedBy: null })
      .where(eq(schema.properties.id, propertyId));
    await setNotifications({
      propertyApproved: true,
      propertyRejected: true,
      reviewPublished: true,
      reviewModerated: true,
    });
  });

  it("rejette avec motif : brouillon + motif persisté + un seul e-mail à l'hôte", async () => {
    const { eq } = await import("drizzle-orm");
    await setNotifications({ propertyRejected: true });

    const res = await decide("reject", "Photos trop sombres, merci de compléter la description.");
    expect(res.status).toBe(200);

    const [updated] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    expect(updated.status).toBe("draft");
    expect(updated.reviewReason).toContain("Photos trop sombres");

    const events = await outboxEvents(`property-decision:${propertyId}:reject`);
    expect(events).toHaveLength(1);
    const [host] = await db.select().from(schema.users).where(eq(schema.users.id, hostId));
    expect(events[0].to).toBe(host.email);

    // Rejouer la même décision ne renvoie pas un second e-mail (idempotence).
    const replay = await decide("reject", "Photos trop sombres, merci de compléter la description.");
    expect(replay.status).toBe(200);
    expect(await outboxEvents(`property-decision:${propertyId}:reject`)).toHaveLength(1);
  });

  it("approuve : mise en ligne, motif effacé, hôte notifié", async () => {
    const { eq } = await import("drizzle-orm");
    await setNotifications({ propertyApproved: true });

    const res = await decide("approve");
    expect(res.status).toBe(200);
    const [updated] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    expect(updated.status).toBe("active");
    expect(updated.reviewReason).toBeNull();
    expect(await outboxEvents(`property-decision:${propertyId}:approve`)).toHaveLength(1);
  });

  it("interrupteur coupé : décision appliquée, aucun envoi", async () => {
    const { eq } = await import("drizzle-orm");
    await setNotifications({ propertyRejected: false });

    const res = await decide("reject", "Titre à préciser.");
    expect(res.status).toBe(200);
    const [updated] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    expect(updated.status).toBe("draft");
    expect(updated.reviewReason).toBe("Titre à préciser.");
    // Aucun nouvel envoi (la décision précédente reste la seule en base).
    expect(await outboxEvents(`property-decision:${propertyId}:reject`)).toHaveLength(1);
  });
});
