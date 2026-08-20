import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
});

describe("templates", () => {
  it("emailVerification produit subject + html + text", () => {
    const t = templates.emailVerification({ firstName: "Jean", url: "https://x/verify?token=abc" });
    expect(t.subject).toMatch(/Vérifiez/);
    expect(t.html).toContain("Jean");
    expect(t.html).toContain("https://x/verify?token=abc");
    expect(t.text).toContain("Jean");
    expect(t.text).not.toContain("<");
  });

  it("passwordReset mentionne 1 heure d'expiration", () => {
    const t = templates.passwordReset({ firstName: "Jean", url: "https://x/reset?token=abc" });
    expect(t.text).toMatch(/1 heure/);
  });

  it("bookingConfirmation contient la référence et le total", () => {
    const t = templates.bookingConfirmation({
      firstName: "Jean", bookingReference: "MBB-TEST", propertyName: "Hôtel X",
      city: "Paris", checkIn: "2026-09-01", checkOut: "2026-09-03",
      total: "200.00", currency: "EUR",
    });
    expect(t.subject).toContain("MBB-TEST");
    expect(t.html).toContain("Hôtel X");
    expect(t.text).toContain("200.00 EUR");
  });

  it("stripHtml enlève les balises et décode les entités", () => {
    expect(stripHtml("<p>Hello &amp; goodbye</p>")).toBe("Hello & goodbye");
    expect(stripHtml("<style>x{color:red}</style><p>ok</p>")).toBe("ok");
  });
});

describe("getMailer factory", () => {
  beforeEach(() => { _resetMailer(); });
  afterEach(() => { _resetMailer(); delete process.env.RESEND_API_KEY; });

  it("retourne ConsoleMailer si RESEND_API_KEY absent", () => {
    delete process.env.RESEND_API_KEY;
    const m = getMailer();
    expect(m.constructor.name).toBe("ConsoleMailer");
  });

  it("retourne ResendMailer si RESEND_API_KEY présent", () => {
    process.env.RESEND_API_KEY = "re_test_xxx";
    _resetMailer();
    const m = getMailer();
    expect(m.constructor.name).toBe("ResendMailer");
  });

  it("est un singleton (2 appels = même instance)", () => {
    delete process.env.RESEND_API_KEY;
    _resetMailer();
    const a = getMailer();
    const b = getMailer();
    expect(a).toBe(b);
  });
});
