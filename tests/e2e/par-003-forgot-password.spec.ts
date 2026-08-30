import { test, expect } from "@playwright/test";

/**
 * PAR-003 — parcours mot de passe oublié (partiel : on ne clique
 * pas sur le lien reçu, mais on vérifie que la demande est acceptée
 * et n'expose pas l'existence du compte).
 */
test.describe("PAR-003 — mot de passe oublié", () => {
  test("depuis /connexion, le lien mène à /mot-de-passe-oublie", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByRole("link", { name: /oublié/i }).click();
    await expect(page).toHaveURL(/mot-de-passe-oublie/);
  });

  test("demande avec email inconnu retourne message générique", async ({ page }) => {
    await page.goto("/mot-de-passe-oublie");
    await page.locator('input[type="email"]').fill("nexistepas@example.local");
    await page.getByRole("button", { name: /Envoyer/i }).click();
    await expect(page.locator("text=/Si un compte existe/")).toBeVisible();
  });
});
