import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// T-025 : les templates lisent app_settings, mais les tests unitaires
// doivent être déterministes → on mocke getSetting pour toujours
// renvoyer les DEFAULTS.
vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  return {
    ...actual,
    getSetting: async <K extends string>(key: K) => {
      // @ts-expect-error accès dynamique DEFAULTS
      return actual.DEFAULTS[key];
    },
  };
});
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleMailer, templates, stripHtml, _resetMailer, getMailer } from "./index";

describe("ConsoleMailer (T-013, §13.5)", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mail-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("écrit un fichier .txt avec To, Subject, contenu", async () => {
    const m = new ConsoleMailer(tmp);
    const { id } = await m.send({
      to: "test@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    // id contient l'email assaini (les . sont remplacés par _)
    expect(id).toMatch(/test@example_com$/);
    const files = require("node:fs").readdirSync(tmp);
    expect(files.length).toBe(1);
    const content = readFileSync(join(tmp, files[0]), "utf8");
    // Le contenu du fichier garde l'email original.
    expect(content).toContain("To: test@example.com");
    expect(content).toContain("Subject: Hello");
    expect(content).toContain("Hi");
    expect(content).toContain("<p>Hi</p>");
  });

  it("assainit les emails avec des caractères spéciaux", async () => {
    const m = new ConsoleMailer(tmp);
    const { id } = await m.send({
      to: "test/../secret@example.com",
      subject: "x", html: "x", text: "x",
    });
    expect(id).not.toContain("/");
    expect(id).not.toContain("..");
  });

  it("réutilise un identifiant stable pour la même clé outbox", async () => {
    const m = new ConsoleMailer(tmp);
    const first = await m.send({ to: "test@example.com", subject: "x", html: "x", text: "x", idempotencyKey: "outbox:event:1" });
    const second = await m.send({ to: "test@example.com", subject: "x", html: "x", text: "x", idempotencyKey: "outbox:event:1" });
    expect(first.id).toBe(second.id);
    expect(require("node:fs").readdirSync(tmp)).toHaveLength(1);
  });
});

describe("templates (T-013 + T-025)", () => {
  it("emailVerification produit subject + html + text (async)", async () => {
    const t = await templates.emailVerification({ firstName: "Jean", url: "https://x/verify?token=abc" });
    expect(t.subject).toMatch(/Vérifiez/);
    expect(t.html).toContain("Jean");
    expect(t.html).toContain("https://x/verify?token=abc");
    expect(t.text).toContain("Jean");
    expect(t.text).not.toContain("<");
  });

  it("passwordReset mentionne 1 heure d'expiration", async () => {
    const t = await templates.passwordReset({ firstName: "Jean", url: "https://x/reset?token=abc" });
    expect(t.text).toMatch(/1 heure/);
  });

  it("bookingConfirmation contient la référence et le total", async () => {
    const t = await templates.bookingConfirmation({
      firstName: "Jean", bookingReference: "MBB-TEST", propertyName: "Hôtel X",
      city: "Paris", checkIn: "2026-09-01", checkOut: "2026-09-03",
      total: "200.00", currency: "EUR",
    });
    expect(t.subject).toContain("MBB-TEST");
    expect(t.html).toContain("Hôtel X");
    expect(t.text).toContain("200.00 EUR");
  });

  it("T-025 : substitution + escapeHtml sur les variables (anti-XSS)", async () => {
    const t = await templates.emailVerification({
      firstName: "<script>alert(1)</script>",
      url: "https://x/verify?token=abc",
    });
    expect(t.html).not.toContain("<script>alert(1)</script>");
    expect(t.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("stripHtml enlève les balises et décode les entités", () => {
    expect(stripHtml("<p>Hello &amp; goodbye</p>")).toBe("Hello & goodbye");
    expect(stripHtml("<style>x{color:red}</style><p>ok</p>")).toBe("ok");
  });
});

describe("getMailer factory", () => {
  beforeEach(() => { _resetMailer(); });
  afterEach(() => { _resetMailer(); delete process.env.RESEND_API_KEY; });

  it("retourne ConsoleMailer si RESEND_API_KEY absent", async () => {
    delete process.env.RESEND_API_KEY;
    const m = await getMailer();
    expect(m.constructor.name).toBe("ConsoleMailer");
  });

  it("retourne ResendMailer si RESEND_API_KEY présent", async () => {
    process.env.RESEND_API_KEY = "re_test_xxx";
    _resetMailer();
    const m = await getMailer();
    expect(m.constructor.name).toBe("ResendMailer");
  });

  it("résout de manière cohérente deux appels consécutifs", async () => {
    delete process.env.RESEND_API_KEY;
    _resetMailer();
    const [a, b] = await Promise.all([getMailer(), getMailer()]);
    expect(a.constructor.name).toBe("ConsoleMailer");
    expect(b.constructor.name).toBe("ConsoleMailer");
  });
});
