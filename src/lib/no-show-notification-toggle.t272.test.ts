import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, like } from "drizzle-orm";

/**
 * T-272 (audit n°8, F2) — interrupteur admin `notifications.bookingNoShow`.
 *
 * Le réglage est mocké (`getSetting`) : un admin qui coupe l'interrupteur
 * stoppe l'envoi immédiatement ; le réactiver le rétablit. Le chemin
 * « défaut actif » (réglage réel) est couvert par `no-show-notification.t272`.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
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

vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return { ...actual, getSetting: vi.fn() };
});

dbTest("T-272 — interrupteur bookingNoShow", () => {
  let sendNoShow: (id: string) => Promise<boolean>;
  let getSetting: ReturnType<typeof vi.fn>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let propId = "";
  let roomId = "";
  const bookingIds: string[] = [];

  beforeAll(async () => {
    const libMod = await import("./no-show-notification");
    sendNoShow = libMod.sendNoShowNotificationIfNeeded;
    const settingsMod = await import("@/lib/settings");
    getSetting = settingsMod.getSetting as unknown as ReturnType<typeof vi.fn>;
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");

    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");

    const { generateSlug, generateBookingReference } = await import("@/lib/utils");
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId: host.id,
        name: "T-272 Toggle Property",
        slug: generateSlug(`t272-toggle-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
      })
      .returning();
    propId = prop.id;
    const [room] = await db
      .insert(schema.rooms)
      .values({
        propertyId: prop.id,
        name: "T-272 Toggle Room",
        roomType: "double",
        maxOccupancy: 2,
        maxAdults: 2,
        basePrice: "100.00",
        currency: "EUR",
        quantity: 5,
        isActive: true,
      })
      .returning();
    roomId = room.id;
  });

  afterAll(async () => {
    if (bookingIds.length) {
      await db.delete(schema.emailOutbox).where(like(schema.emailOutbox.eventKey, "no-show:%"));
      await db.delete(schema.bookings).where(eq(schema.bookings.propertyId, propId));
    }
    if (roomId) await db.delete(schema.rooms).where(eq(schema.rooms.id, roomId));
    if (propId) await db.delete(schema.properties).where(eq(schema.properties.id, propId));
  });

  async function makeNoShowBooking(): Promise<string> {
    const { generateBookingReference } = await import("@/lib/utils");
    const [u] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    const [b] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: generateBookingReference(),
        userId: u.id,
        propertyId: propId,
        roomId,
        status: "no_show",
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        numNights: 2,
        numAdults: 2,
        numChildren: 0,
        guestFirstName: "Toggle",
        guestLastName: "T272",
        guestEmail: u.email,
        paymentStatus: "pending",
        subtotal: "200.00",
        taxes: "0",
        discount: "0",
        total: "200.00",
        currency: "EUR",
        commissionRate: "15.00",
        commissionAmount: "30.00",
        netToHost: "170.00",
      })
      .returning();
    bookingIds.push(b.id);
    return b.id;
  }

  it("interrupteur coupé → aucun envoi", async () => {
    getSetting.mockResolvedValue({ bookingNoShow: false });
    const id = await makeNoShowBooking();
    await expect(sendNoShow(id)).resolves.toBe(false);
    const rows = await db
      .select({ k: schema.emailOutbox.eventKey })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `no-show:${id}`));
    expect(rows).toHaveLength(0);
  });

  it("interrupteur (ré)activé → l'envoi repart", async () => {
    getSetting.mockResolvedValue({ bookingNoShow: true });
    const id = await makeNoShowBooking();
    await expect(sendNoShow(id)).resolves.toBe(true);
    const [mail] = await db
      .select()
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.eventKey, `no-show:${id}`));
    expect(mail).toBeTruthy();
    expect(mail?.to).toBe("customer@mybestbooking.com");
  });
});
