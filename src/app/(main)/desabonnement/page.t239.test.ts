import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-239 (audit n°3, F8) — bout-en-bout du désabonnement en un clic.
 *
 * Contrat vérifié ici, sur la vraie base :
 *   1. un lien signé valide coupe `users.priceAlertEnabled` ;
 *   2. un second clic est idempotent (aucune erreur, état inchangé) ;
 *   3. un jeton invalide (ou détourné vers un autre compte) ne modifie rien ;
 *   4. la page est `noindex` — surface privée atteinte par un lien d'e-mail.
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

// `src/lib/server-locale.ts` importe `server-only`, qui lève hors composant
// serveur : en vitest il faut le neutraliser pour pouvoir appeler la page.
vi.mock("server-only", () => ({}));

dbTest("T-239 — page publique de désabonnement", () => {
  let page: (props: { searchParams: Promise<{ u?: string; c?: string; s?: string }> }) => Promise<unknown>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let sign: (userId: string, category: "price_alerts") => string;
  let generateMetadata: () => Promise<import("next").Metadata>;
  let customerId = "";
  let initialPriceAlert = true;

  beforeAll(async () => {
    const pageModule = await import("./page");
    page = pageModule.default;
    generateMetadata = pageModule.generateMetadata;
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ({ signUnsubscribeToken: sign } = await import("@/lib/unsubscribe"));
    const meta = await generateMetadata();
    const robots = meta.robots as { index?: boolean; follow?: boolean } | undefined;
    expect(robots?.index).toBe(false);
    expect(robots?.follow).toBe(false);

    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, process.env.T239_EMAIL ?? "customer@mybestbooking.com"))
      .limit(1);
    expect(rows.length).toBe(1);
    customerId = rows[0].id;
    initialPriceAlert = rows[0].priceAlertEnabled ?? true;

    // On part d'un compte abonné aux alertes prix.
    await db
      .update(schema.users)
      .set({ priceAlertEnabled: true })
      .where(eq(schema.users.id, customerId));
  });

  afterAll(async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.users)
      .set({ priceAlertEnabled: initialPriceAlert })
      .where(eq(schema.users.id, customerId));
  });

  async function priceAlertEnabled(): Promise<boolean> {
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({ enabled: schema.users.priceAlertEnabled })
      .from(schema.users)
      .where(eq(schema.users.id, customerId))
      .limit(1);
    return row.enabled ?? false;
  }

  it("désabonne l'utilisateur avec un jeton valide, puis reste idempotent", async () => {
    const token = sign(customerId, "price_alerts");
    expect(await priceAlertEnabled()).toBe(true);

    await page({ searchParams: Promise.resolve({ u: customerId, c: "price_alerts", s: token }) });
    expect(await priceAlertEnabled()).toBe(false);

    // second clic : toujours désabonné, pas d'erreur
    await page({ searchParams: Promise.resolve({ u: customerId, c: "price_alerts", s: token }) });
    expect(await priceAlertEnabled()).toBe(false);
  });

  it("n'agit pas avec un jeton invalide, absent ou visant un autre compte", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.users)
      .set({ priceAlertEnabled: true })
      .where(eq(schema.users.id, customerId));

    await page({ searchParams: Promise.resolve({ u: customerId, c: "price_alerts", s: "faux" }) });
    expect(await priceAlertEnabled()).toBe(true);

    await page({ searchParams: Promise.resolve({ u: customerId, c: "bookings", s: "faux" }) });
    expect(await priceAlertEnabled()).toBe(true);

    await page({ searchParams: Promise.resolve({}) });
    expect(await priceAlertEnabled()).toBe(true);

    // jeton signé pour un autre utilisateur → refusé
    const tokenAutre = sign("00000000-0000-0000-0000-000000000000", "price_alerts");
    await page({
      searchParams: Promise.resolve({ u: customerId, c: "price_alerts", s: tokenAutre }),
    });
    expect(await priceAlertEnabled()).toBe(true);
  });
});
