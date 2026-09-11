import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * T-258 (audit n°6, B5) — « tous les avis » d'un hébergement.
 *
 * Constat d'exécution : la fiche chargeait `.limit(5)` sans compteur ni lien,
 * alors que l'API publique des avis était déjà paginée — un bien à 40 avis en
 * montrait 5 pour toujours, sans que le visiteur le sache.
 *
 * Ce test verrouille, sur la vraie base :
 *   1. la fiche affiche le **compteur** d'avis approuvés et un lien « Voir les N
 *      avis » dès qu'il y a plus de lignes que la fenêtre de 5 ;
 *   2. la page dédiée rend les 20 premiers avis puis la page suivante (les liens
 *      `?page=2` et « page 1 sur 2 » existent) ;
 *   3. un slug inconnu → 404 (`notFound()`), comme la fiche.
 *
 * Données de test : 22 avis approuvés ajoutés sur `b-b-toscana` (2 existants →
 * 24), supprimés puis agrégats recalculés en fin de test.
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

vi.mock("server-only", () => ({}));
// La fiche embarque des composants clients (en-tête : favori/partage → useRouter).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/hebergement",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
// Visiteur anonyme : la fiche emprunte le chemin public (cache TTL 60 s).
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => null) }));
// …et le bouton favori consomme le contexte Toast (absent hors arbre Next).
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const SLUG = "b-b-toscana";
const ADDED = 22;
let propertyId = "";
let userId = "";
const createdReviewIds: string[] = [];

beforeAll(async () => {
  if (!dbAvailable) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [property] = await db
    .select({ id: schema.properties.id })
    .from(schema.properties)
    .where(eq(schema.properties.slug, SLUG));
  propertyId = property!.id;
  const [customer] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "customer@mybestbooking.com"));
  userId = customer!.id;

  const base = Date.now();
  for (let index = 0; index < ADDED; index += 1) {
    const [row] = await db
      .insert(schema.reviews)
      .values({
        userId,
        propertyId,
        overallRating: (9 + (index % 2) * 0.5).toFixed(1),
        positiveComment: `T258 avis ${index}`,
        status: "approved",
        helpfulCount: 0,
        travelerType: "couple",
        // Tri `desc(createdAt)` : un horodatage par avis rend la pagination
        // déterministe — « avis 0 » est le plus récent, « avis 21 » le plus ancien.
        createdAt: new Date(base - index * 60_000),
      })
      .returning({ id: schema.reviews.id });
    createdReviewIds.push(row!.id);
  }
  const { recomputePropertyReviewAggregate } = await import("@/lib/review-aggregates");
  await recomputePropertyReviewAggregate(db, propertyId);
});

afterAll(async () => {
  if (!dbAvailable || createdReviewIds.length === 0) return;
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const { inArray } = await import("drizzle-orm");
  await db.delete(schema.reviews).where(inArray(schema.reviews.id, createdReviewIds));
  createdReviewIds.length = 0;
  const { recomputePropertyReviewAggregate } = await import("@/lib/review-aggregates");
  await recomputePropertyReviewAggregate(db, propertyId);
});

dbTest("T-258 — compteur et page « tous les avis »", () => {
  it("la fiche annonce le total et renvoie vers la page dédiée", async () => {
    const fiche = (await import("./[slug]/page")).default;
    const html = renderToStaticMarkup(
      (await fiche({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({}),
      })) as React.ReactElement,
    );

    expect(html).toContain("24 avis");
    expect(html).toContain(`/hebergement/${SLUG}/avis`);
    expect(html).toContain("Voir les 24 avis");
    // La fiche reste bornée à 5 avis : le 6ᵉ (créé ici) n'y figure pas.
    expect(html).toContain("T258 avis 0");
    expect(html).not.toContain("T258 avis 5");
  });

  it("la page dédiée pagine 20 par 20 et propose la suite", async () => {
    const page = (await import("./[slug]/avis/page")).default;
    const first = renderToStaticMarkup(
      (await page({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({}),
      })) as React.ReactElement,
    );
    expect(first).toContain("page 1 sur 2");
    expect(first).toContain("?page=2");
    // Page 1 = les 20 avis les plus récents (indices 0 → 19).
    expect(first).toContain("T258 avis 0");
    expect(first).toContain("T258 avis 19");
    expect(first).not.toContain("T258 avis 20");

    const second = renderToStaticMarkup(
      (await page({
        params: Promise.resolve({ slug: SLUG }),
        searchParams: Promise.resolve({ page: "2" }),
      })) as React.ReactElement,
    );
    expect(second).toContain("page 2 sur 2");
    expect(second).toContain("?page=1");
    // Fin de liste : indices 20 et 21 (les 2 avis seed complètent la page).
    expect(second).toContain("T258 avis 21");
    expect(second).not.toContain("T258 avis 19");
  });

  it("slug inconnu → notFound()", async () => {
    const page = (await import("./[slug]/avis/page")).default;
    await expect(
      page({
        params: Promise.resolve({ slug: "slug-inexistant-t258" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow();
  });
});
