import { test, expect } from "@playwright/test";

/**
 * PAR-002 (partiel) — recherche par ville (sans disponibilité pour
 * l'instant, cf. FEATURES.md). Vérifie que la recherche renvoie des
 * résultats et que la fiche property est accessible depuis la liste.
 */
test.describe("PAR-002 — recherche", () => {
  test("/recherche affiche au moins un résultat après filtrage ville=Paris", async ({ page }) => {
    await page.goto("/recherche?city=Paris");
    // Le RSC rend un h1
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // Au moins un lien vers une fiche
    const card = page.locator('a[href^="/hebergement/"]').first();
    await expect(card).toBeVisible();
  });

  test("Fiche property s'ouvre et affiche titre + JSON-LD", async ({ page }) => {
    const home = await page.goto("/");
    expect(home?.status()).toBe(200);
    const first = page.locator('a[href^="/hebergement/"]').first();
    await first.click();
    await expect(page).toHaveURL(/\/hebergement\//);
    // JSON-LD Schema.org
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain("Hotel");
  });
});
