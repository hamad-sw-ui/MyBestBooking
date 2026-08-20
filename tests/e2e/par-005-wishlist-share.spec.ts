import { test, expect } from "@playwright/test";

/**
 * PAR-005 — wishlist partagée par lien public.
 * Vérifie qu'un token invalide donne un 404 propre (page not-found).
 */
test.describe("PAR-005 — wishlist share", () => {
  test("token invalide → not-found custom", async ({ page }) => {
    const res = await page.goto("/wishlists/share/token-inconnu-xyz");
    expect(res?.status()).toBe(404);
    await expect(page.locator("text=/Page introuvable/i")).toBeVisible();
  });
});
