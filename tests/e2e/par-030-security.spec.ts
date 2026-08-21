import { test, expect } from "@playwright/test";

/**
 * PAR-030 à PAR-033 — headers de sécurité et proxy edge.
 */
test.describe("Sécurité — headers HTTP", () => {
  test("headers de sécurité posés sur /", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["content-security-policy"]).toBeTruthy();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
  });

  test("robots.txt disallow /api/ /dashboard/", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const t = await res.text();
    expect(t).toContain("Disallow: /api/");
    expect(t).toContain("Disallow: /dashboard/");
  });

  test("sitemap.xml existe", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const t = await res.text();
    expect(t).toContain("<urlset");
  });
});
