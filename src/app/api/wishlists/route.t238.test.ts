import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-238 (audit n°3, F7) — le partage d'une wishlist était durable et indexable.
 *
 * Constat d'audit : `/wishlists/share/[token]` exposait `title`/`description`
 * sans `robots: { index: false }` (seule surface privée dans ce cas), et le
 * `share_token` n'avait ni échéance ni rotation côté UI — un lien transmis
 * restait valable à vie.
 *
 * Contrat vérifié ici : la rotation génère un **nouveau** token et **invalide**
 * immédiatement l'ancien (l'API `/api/wishlists/shared/<token>` répond 404).
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

dbTest("T-238 — rotation du lien de partage", () => {
  let PATCH: (req: unknown) => Promise<Response>;
  let GET: (req: unknown, ctx: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let customerId = "";
  let wishlistId = "";
  const tokens: string[] = [];

  async function call(body: Record<string, unknown>) {
    const { NextRequest } = await import("next/server");
    return PATCH(
      new NextRequest("http://localhost/api/wishlists", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  async function sharedStatus(token: string) {
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest(`http://localhost/api/wishlists/shared/${token}`), {
      params: Promise.resolve({ token }),
    });
    return res.status;
  }

  beforeAll(async () => {
    PATCH = (await import("./route")).PATCH as unknown as typeof PATCH;
    const shared = await import("./shared/[token]/route");
    GET = shared.GET as unknown as typeof GET;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const auth = await import("@/lib/auth");
    const getCurrentUser = auth.getCurrentUser as unknown as ReturnType<typeof vi.fn>;

    const [customer] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    customerId = customer.id;
    getCurrentUser.mockResolvedValue({ id: customerId, role: "customer", email: customer.email });

    const [created] = await db
      .insert(schema.wishlists)
      .values({ userId: customerId, name: "T238 rotation", isPublic: true })
      .returning();
    wishlistId = created.id;
  });

  afterAll(async () => {
    if (!db) return;
    const { eq } = await import("drizzle-orm");
    await db.delete(schema.wishlists).where(eq(schema.wishlists.id, wishlistId));
  });

  it("un nouveau lien invalide immédiatement l'ancien", async () => {
    const first = await call({ wishlistId, isPublic: true });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { wishlist?: { shareToken?: string } };
    const firstToken = firstBody.wishlist?.shareToken;
    expect(firstToken, "token initial").toBeTruthy();
    tokens.push(firstToken as string);
    expect(await sharedStatus(firstToken as string)).toBe(200);

    // Rotation (bouton « Nouveau lien »).
    const second = await call({ wishlistId, isPublic: true, rotateShareToken: true });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { wishlist?: { shareToken?: string } };
    const secondToken = secondBody.wishlist?.shareToken;
    expect(secondToken).toBeTruthy();
    expect(secondToken).not.toBe(firstToken);
    tokens.push(secondToken as string);

    // L'ancien lien ne sert plus à rien, le nouveau fonctionne.
    expect(await sharedStatus(firstToken as string)).toBe(404);
    expect(await sharedStatus(secondToken as string)).toBe(200);
  });

  it("repasser la liste en privé coupe aussi l'accès public", async () => {
    const res = await call({ wishlistId, isPublic: false });
    expect(res.status).toBe(200);
    if (tokens.length > 0) {
      expect(await sharedStatus(tokens[tokens.length - 1])).toBe(404);
    }
  });
});
