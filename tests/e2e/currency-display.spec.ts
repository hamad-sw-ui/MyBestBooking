import { test, expect } from "@playwright/test";

test.describe("Devise d'affichage publique", () => {
  test("le sélecteur expose le catalogue six devises et transmet displayCurrency", async ({ page }) => {
    await page.goto("/recherche", { waitUntil: "domcontentloaded" });
    const selector = page.getByLabel("Devise d'affichage");
    await expect(selector).toBeVisible();
    await expect(selector.locator("option")).toHaveCount(6);
    await expect(selector.locator("option")).toHaveText(["EUR", "USD", "GBP", "CHF", "MAD", "XAF"]);

    await selector.selectOption("MAD");
    await expect(page).toHaveURL(/displayCurrency=MAD/);
  });

  test("la recherche EN conserve le fallback de devise sans texte de contrôle FR", async ({ page }) => {
    await page.goto("/recherche?lang=en", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Display currency")).toBeVisible();
    await expect(page.getByLabel("Destination")).toBeVisible();
  });
});
