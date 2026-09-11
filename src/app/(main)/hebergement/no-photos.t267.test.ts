import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";

/**
 * T-267 (audit n°7, C3) — une annonce **sans photo** ne sert plus d'image de
 * substitution : la galerie affichait jadis `placeholder-property.jpg`, qui
 * était une copie de `villa-azure-1.jpg` — les photos d'UNE autre propriété,
 * présentées comme les siennes (fiche + carte).
 *
 * Ce test verrouille, sur la vraie base :
 *   1. une annonce sans `mainImage` ni `images` → état vide « pas de photos »
 *      (`data-testid="no-photos"`), **aucun** `placeholder-property` dans le
 *      HTML rendu ;
 *   2. une annonce du seed AVEC photos → la galerie réelle, aucun état vide,
 *      aucun placeholder.
 *
 * Fixture : une annonce sans photo créée puis supprimée.
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
// La fiche embarque des composants clients (en-tête : favori/partage, avis…).
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
// Visiteur anonyme : la fiche emprunte le chemin public.
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => null) }));
// …et le bouton favori consomme le contexte Toast (absent hors arbre Next).
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const SEED_SLUG = "b-b-toscana";

dbTest("T-267 — fiche publique : galerie honnête", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId = "";
  let noPhotoPropertyId = "";
  let noPhotoSlug = "";

  beforeAll(async () => {
    const { db: dbInstance } = await import("@/db");
    db = dbInstance;
    schema = await import("@/db/schema");
    const [host] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"));
    hostId = host!.id;

    const { generateSlug } = await import("@/lib/utils");
    noPhotoSlug = generateSlug(`t267-no-photos-${Date.now()}`);
    const [prop] = await db
      .insert(schema.properties)
      .values({
        hostId,
        name: "T-267 Sans Photo",
        slug: noPhotoSlug,
        type: "house",
        city: "TestCity",
        country: "FR",
        status: "active",
        description: "Annonce de test sans aucune photo.",
        mainImage: null,
        images: null,
      })
      .returning();
    noPhotoPropertyId = prop.id;
  });

  afterAll(async () => {
    if (noPhotoPropertyId) {
      await db.delete(schema.properties).where(eq(schema.properties.id, noPhotoPropertyId));
    }
  });

  async function renderPropertyPage(slug: string): Promise<string> {
    const mod = await import("./[slug]/page");
    return renderToStaticMarkup(
      await mod.default({
        params: Promise.resolve({ slug }),
        searchParams: Promise.resolve({}),
      }),
    );
  }

  it("annonce sans photo → état vide, aucun placeholder (ni photo d'autrui)", async () => {
    const html = await renderPropertyPage(noPhotoSlug);
    expect(html).toContain("data-testid=\"no-photos\"");
    expect(html).toContain("Pas encore de photos pour cet hébergement");
    expect(html).not.toContain("placeholder-property");
    expect(html).not.toContain("villa-azure");
  });

  it("annonce du seed avec photos → galerie réelle, pas d'état vide ni de placeholder", async () => {
    const html = await renderPropertyPage(SEED_SLUG);
    expect(html).not.toContain("data-testid=\"no-photos\"");
    expect(html).not.toContain("placeholder-property");
    // Les vraies photos du seed sont servies.
    expect(html).toContain("bb-toscana-1.jpg");
  });
});
