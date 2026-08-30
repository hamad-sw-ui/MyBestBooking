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

  it("T-149 : le logo des emails respecte la marque MyBestBooking (CamelCase)", async () => {
    const t = await templates.welcomeEmail({ firstName: "Awa", url: "https://x/dashboard" });
    expect(t.html).toContain(">MyBest<");
    expect(t.html).toContain(">Booking<");
    // L'ancien libellé tout-minuscules ne doit plus apparaître comme logo.
    expect(t.html).not.toContain(">mybest<");
    expect(t.html).not.toContain(">booking<");
    // Le slogan de marque reste présent.
    expect(stripHtml(t.html)).toContain("MyBestBooking");
  });

  it("T-149 : welcomeEmail contient le prénom et le bouton du compte", async () => {
    const t = await templates.welcomeEmail({ firstName: "Awa", url: "https://x/dashboard" });
    expect(t.subject).toMatch(/Bienvenue/);
    expect(t.html).toContain("Awa");
    expect(t.html).toContain("https://x/dashboard");
    expect(t.text).toContain("Awa");
    expect(t.text).not.toContain("<");
  });

  it("T-149 : bookingReminder (J-3/J-1) porte la référence et le libellé de délai", async () => {
    const t = await templates.bookingReminder({
      firstName: "Jean", bookingReference: "MBB-REM", propertyName: "Hôtel Y",
      city: "Douala", checkIn: "2026-09-10", checkOut: "2026-09-13",
      daysLabel: "Votre arrivée est dans 3 jours", url: "https://x/mes-reservations",
    });
    expect(t.html).toContain("MBB-REM");
    expect(t.html).toContain("Hôtel Y");
    expect(t.html).toContain("dans 3 jours");
    expect(t.text).toContain("2026-09-10");
  });

  it("T-149 : reviewRequest contient le lien d'avis et la propriété", async () => {
    const t = await templates.reviewRequest({
      firstName: "Jean", propertyName: "Hôtel Z", bookingReference: "MBB-REV",
      url: "https://x/mes-reservations/avis/123",
    });
    expect(t.subject).toContain("Hôtel Z");
    expect(t.html).toContain("https://x/mes-reservations/avis/123");
    expect(t.html).toContain("MBB-REV");
    expect(t.text).not.toContain("<");
  });

  it("T-149 : priceAlert utilise le layout de marque et les montants", () => {
    const t = templates.priceAlert({
      firstName: "Awa", propertyName: "Suite Océan", price: "45000", currency: "XAF",
      maxPrice: "60000", offerLabel: "à partir de (prix de base)",
      url: "https://x/hebergement/suite-ocean",
    });
    expect(t.subject).toBe("Alerte prix : Suite Océan");
    expect(t.html).toContain(">MyBest<");
    expect(t.html).toContain("45000 XAF");
    expect(t.html).toContain("https://x/hebergement/suite-ocean");
    expect(t.text).toContain("Suite Océan");
    expect(t.text).not.toContain("<");
  });

  it("T-149 : les nouveaux templates échappent les variables (anti-XSS)", async () => {
    const t = await templates.bookingReminder({
      firstName: "<img src=x onerror=alert(1)>", bookingReference: "MBB", propertyName: "P",
      city: "C", checkIn: "2026-09-10", checkOut: "2026-09-11", daysLabel: "demain", url: "https://x",
    });
    expect(t.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(t.html).toContain("&lt;img");
  });

  it("T-149 : l'habillage est en français par défaut (langue du destinataire absente)", async () => {
    const t = await templates.bookingConfirmation({
      firstName: "Jean", bookingReference: "MBB-FR", propertyName: "Hôtel X",
      city: "Paris", checkIn: "2026-09-01", checkOut: "2026-09-03",
      total: "200.00", currency: "EUR",
    });
    expect(t.html).toContain("Réservez mieux. Voyagez plus.");
    expect(t.html).toContain(">Arrivée<");
    expect(t.html).toContain(">Total<");
    expect(t.html).toContain('lang="fr"');
    expect(t.html).not.toContain("Book better");
  });

  it("T-149 : un destinataire anglophone reçoit l'habillage en anglais", async () => {
    const t = await templates.bookingConfirmation({
      firstName: "John", bookingReference: "MBB-EN", propertyName: "Hotel X",
      city: "Paris", checkIn: "2026-09-01", checkOut: "2026-09-03",
      total: "200.00", currency: "EUR", language: "en",
    });
    expect(t.html).toContain("Book better. Travel further.");
    expect(t.html).toContain(">Check-in<");
    expect(t.html).toContain(">Total<");
    expect(t.html).toContain('lang="en"');
    expect(t.html).not.toContain("Réservez mieux");
    expect(t.html).not.toContain(">Arrivée<");
    // La version texte reflète aussi l'anglais.
    expect(t.text).toContain("Check-in");
    expect(t.text).not.toContain("Arrivée");
  });

  it("T-149 : priceAlert entièrement localisé (corps plateforme)", () => {
    const fr = templates.priceAlert({
      firstName: "Awa", propertyName: "Suite", price: "100", currency: "EUR",
      maxPrice: "120", offerLabel: "à partir de (prix de base)", url: "https://x", language: "fr",
    });
    expect(fr.subject).toBe("Alerte prix : Suite");
    expect(fr.text).toContain("Bonjour Awa");
    const en = templates.priceAlert({
      firstName: "Awa", propertyName: "Suite", price: "100", currency: "EUR",
      maxPrice: "120", offerLabel: "from (base price)", url: "https://x", language: "en",
    });
    expect(en.subject).toBe("Price alert: Suite");
    expect(en.text).toContain("Hi Awa");
    expect(en.text).toContain("below your threshold");
    expect(en.text).not.toContain("Bonjour");
  });

  it("T-149 : la langue arabe (non traduite) retombe sur le français", async () => {
    const t = await templates.welcomeEmail({ firstName: "Awa", url: "https://x", language: "ar" });
    expect(t.html).toContain('lang="fr"');
    expect(t.html).toContain("Réservez mieux");
  });

  it("T-149 : guestAccountClaim localisé en anglais", async () => {
    const t = await templates.guestAccountClaim({
      firstName: "John", url: "https://x", bookingReference: "MBB-G", language: "en",
    });
    expect(t.subject).toContain("Access your booking");
    expect(t.text).toContain("Activate my access");
    expect(t.text).not.toContain("Activer mon accès");
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
