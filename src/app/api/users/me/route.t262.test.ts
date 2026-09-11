import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

/**
 * T-262 (audit n°6, B8) — suppression de compte : le crédit gelé laissait
 * aucune trace.
 *
 * Constat : `DELETE /api/users/me` anonymisait l'identité sans toucher
 * `users.wallet_balance` ni écrire dans `wallet_transactions`. Un solde de
 * crédit (gel T-248 §3 : crédit futur non consommable) disparaissait donc en
 * silence, sur une ligne que plus personne ne pouvait lire.
 *
 * Contrats vérifiés ici :
 *  - un compte supprimé avec solde > 0 laisse une ligne `account_closed`
 *    (montant **0**, `balanceAfter` = solde) dans la transaction ;
 *  - `wallet_balance` **n'est pas modifié** (aucune consommation — le gel) ;
 *  - un compte à solde nul n'écrit rien (pas de bruit dans le journal) ;
 *  - l'anonymisation continue de s'appliquer (contrat T-242 inchangé).
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

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

// `cookies()` n'existe pas hors requête (les autres tests de route mockent
// `getCurrentUser` pour la même raison) : on fournit le strict nécessaire.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ delete: vi.fn() })),
}));

dbTest("T-262 — suppression de compte : le crédit gelé est tracé, jamais consommé", () => {
  let DELETE: typeof import("./route").DELETE;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let withBalanceId = "";
  let zeroBalanceId = "";
  let withBalanceEmail = "";
  let zeroBalanceEmail = "";

  async function createUser(prefix: string, balance: string) {
    const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@test.local`;
    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        firstName: "Clôture",
        lastName: "Wallet",
        role: "customer",
        language: "fr",
        walletBalance: balance,
      })
      .returning();
    return { id: user.id, email };
  }

  beforeAll(async () => {
    DELETE = (await import("./route")).DELETE;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const authMod = await import("@/lib/auth");
    getCurrentUser = authMod.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const a = await createUser("t262-solde", "12.50");
    withBalanceId = a.id;
    withBalanceEmail = a.email;
    const b = await createUser("t262-zero", "0.00");
    zeroBalanceId = b.id;
    zeroBalanceEmail = b.email;
  });

  afterAll(async () => {
    const ids = [withBalanceId, zeroBalanceId].filter(Boolean);
    if (ids.length) {
      await db.delete(schema.walletTransactions).where(inArray(schema.walletTransactions.userId, ids));
      await db.delete(schema.users).where(inArray(schema.users.id, ids));
    }
  });

  it("écrit une ligne account_closed (montant 0) et laisse le solde intact", async () => {
    getCurrentUser.mockResolvedValue({
      id: withBalanceId,
      role: "customer",
      email: withBalanceEmail,
      walletBalance: "12.50",
    });

    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });

    const rows = await db
      .select()
      .from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, withBalanceId));
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("account_closed");
    expect(rows[0].amount).toBe("0.00");
    expect(rows[0].balanceAfter).toBe("12.50");

    // Le gel T-248 §3 reste entier : le solde n'a pas bougé.
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, withBalanceId));
    expect(user.walletBalance).toBe("12.50");
    expect(user.deletedAt).not.toBeNull();
    // L'anonymisation (T-242) continue de s'appliquer.
    expect(user.email).toMatch(/^deleted-[0-9a-f]{16}@anonymized\.local$/);
  });

  it("n'écrit rien quand le solde est nul (aucun crédit perdu)", async () => {
    getCurrentUser.mockResolvedValue({
      id: zeroBalanceId,
      role: "customer",
      email: zeroBalanceEmail,
      walletBalance: "0.00",
    });

    const res = await DELETE();
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(schema.walletTransactions)
      .where(
        and(
          eq(schema.walletTransactions.userId, zeroBalanceId),
          eq(schema.walletTransactions.kind, "account_closed"),
        ),
      );
    expect(rows).toHaveLength(0);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, zeroBalanceId));
    expect(user.walletBalance).toBe("0.00");
    expect(user.deletedAt).not.toBeNull();
  });
});
