import { test, expect } from "@playwright/test";

/**
 * Smoke test — vérifie que le site répond et que les pages
 * principales chargent sans erreur JS.
 *
 * PAR non associé (utilitaire).
 */

test.describe("Smoke — pages publiques", () => {
  test("Homepage charge et affiche le logo", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/mybestbooking/i);
    await expect(page.getByRole("heading", { name: /Réservez mieux/i })).toBeVisible();
  });

  test("Health API répond {ok:true}", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test("/recherche charge", async ({ page }) => {
    await page.goto("/recherche", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/recherche/);
  });

  test("/connexion charge le formulaire", async ({ page }) => {
    await page.goto("/connexion", { waitUntil: "domcontentloaded" });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});

test.describe("Smoke — protection routes privées", () => {
  test("/mon-compte sans cookie redirige vers /connexion", async ({ page }) => {
    const res = await page.goto("/mon-compte", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/connexion/);
    expect(page.url()).toContain("next=%2Fmon-compte");
  });

  test("/dashboard sans cookie redirige vers /connexion", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/connexion/);
  });
});
