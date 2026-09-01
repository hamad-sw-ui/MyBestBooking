import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// T-025 : les templates lisent app_settings, mais les tests unitaires
// doivent être déterministes → on mocke getSetting pour toujours
// renvoyer les DEFAULTS (mocké via vi.fn pour pouvoir simuler une
// personnalisation admin ponctuelle — T-150).
const settingsMock = vi.hoisted(() => ({ getSetting: vi.fn() }));
vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  settingsMock.getSetting.mockImplementation(async (key: string) => {
    // @ts-expect-error accès dynamique DEFAULTS
    return actual.DEFAULTS[key];
  });
  return { ...actual, getSetting: settingsMock.getSetting };
});
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleMailer, templates, stripHtml, _resetMailer, getMailer } from "./index";
import { DEFAULTS } from "@/lib/settings";
import { mailStrings } from "./strings";

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

  it("T-151 : emailVerification — habillage anglais quand la langue du destinataire est en", async () => {
    const t = await templates.emailVerification({
      firstName: "John", url: "https://x/verify?token=abc", language: "en",
    });
    expect(t.html).toContain("Verify my email");
    expect(t.html).toContain("Book better. Travel further.");
    expect(t.html).toContain('lang="en"');
    expect(t.html).not.toContain("Vérifier mon email");
  });

  it("T-151 : emailVerification — habillage français par défaut", async () => {
    const t = await templates.emailVerification({
      firstName: "Jean", url: "https://x/verify?token=abc",
    });
    expect(t.html).toContain("Vérifier mon email");
    expect(t.html).toContain("Réservez mieux. Voyagez plus.");
  });

  it("T-150 : newMessage (fr par défaut) — sujet/corps localisés + CTA vers la conversation", async () => {
    const t = await templates.newMessage({
      firstName: "Marie", senderName: "Jean", url: "http://localhost:3000/messages/conv-1",
    });
    expect(t.subject).toBe("Nouveau message de Jean");
    expect(t.html).toContain("Répondre au message");
    expect(t.html).toContain('href="http://localhost:3000/messages/conv-1"');
    expect(t.html).toContain("Réservez mieux. Voyagez plus.");
    expect(t.text).toContain("Vous avez reçu un nouveau message de Jean");
    expect(t.text).not.toContain("<");
  });

  it("T-150 : newMessage anglophone — sujet/corps/bouton en anglais (langue du destinataire)", async () => {
    const t = await templates.newMessage({
      firstName: "Marie", senderName: "Jean", url: "http://localhost:3000/messages/conv-1", language: "en",
    });
    expect(t.subject).toBe("New message from Jean");
    expect(t.html).toContain("Reply to the message");
    expect(t.html).toContain("You have received a new message from Jean");
    expect(t.html).toContain("Book better. Travel further.");
    expect(t.html).toContain('href="http://localhost:3000/messages/conv-1"');
    expect(t.html).not.toContain("Répondez directement");
  });

  it("T-150 : newMessage sans url → aucun CTA (compatibilité appelants)", async () => {
    const t = await templates.newMessage({ firstName: "Marie", senderName: "Jean" });
    expect(t.subject).toBe("Nouveau message de Jean");
    expect(t.html).not.toContain("Répondre au message");
  });

  it("T-150 : une personnalisation admin du bloc newMessage est respectée", async () => {
    settingsMock.getSetting.mockResolvedValueOnce({
      ...DEFAULTS.emailTemplates,
      newMessage: { subject: "Perso {senderName}", body: "Perso {firstName} — {url}" },
    });
    const t = await templates.newMessage({
      firstName: "Marie", senderName: "Jean", url: "http://localhost:3000/messages/x", language: "en",
    });
    expect(t.subject).toBe("Perso Jean");
    expect(t.html).toContain("Perso Marie — http://localhost:3000/messages/x");
    // Le bouton plateforme reste ajouté même en cas de personnalisation
    // (localisé dans la langue du destinataire : ici en).
    expect(t.html).toContain("Reply to the message");
  });

  it("T-150 : newMessage échappe l'expéditeur (anti-XSS)", async () => {
    const t = await templates.newMessage({
      firstName: "M", senderName: "<script>alert(1)</script>", url: "/messages/1", language: "en",
    });
    expect(t.subject).not.toContain("<script>");
    expect(t.subject).toContain("&lt;script&gt;");
    expect(t.html).not.toContain("<script>");
  });

  it("T-150 : bookingHostNotification — habillage anglais pour un hôte anglophone", async () => {
    const t = await templates.bookingHostNotification({
      hostFirstName: "Paul", bookingReference: "MBB-HOST", propertyName: "Villa X",
      guestName: "Marie D.", checkIn: "2026-09-01", checkOut: "2026-09-05", language: "en",
    });
    // Habillage (en-têtes de tableau, mention dashboard, slogan) en anglais.
    expect(t.html).toContain(">Guest<");
    expect(t.html).toContain(">Check-in<");
    expect(t.html).toContain(">Check-out<");
    expect(t.html).toContain("/dashboard/bookings");
    expect(t.html).toContain("Book better. Travel further.");
    expect(t.text).toContain("Marie D.");
    expect(t.text).not.toContain("<");
  });

  it("T-150 : bookingHostNotification — habillage français par défaut", async () => {
    const t = await templates.bookingHostNotification({
      hostFirstName: "Paul", bookingReference: "MBB-HOST", propertyName: "Villa X",
      guestName: "Marie D.", checkIn: "2026-09-01", checkOut: "2026-09-05",
    });
    expect(t.html).toContain(">Voyageur<");
    expect(t.html).toContain(">Arrivée<");
    expect(t.html).toContain("Réservez mieux. Voyagez plus.");
    expect(t.html).not.toContain(">Guest<");
  });

  it("T-150 : bookingHostCancellation — hôte anglophone reçoit l'annulation en anglais", () => {
    const t = templates.bookingHostCancellation({
      hostFirstName: "Paul", bookingReference: "MBB-CANCEL", propertyName: "Villa X",
      guestName: "Marie D.", checkIn: "2026-09-01", checkOut: "2026-09-05",
      reason: "No-show", language: "en",
    });
    expect(t.subject).toBe("Cancellation of your booking MBB-CANCEL");
    expect(t.html).toContain("has been cancelled");
    expect(t.html).toContain(">Guest<");
    expect(t.html).toContain("Reason : No-show");
    expect(t.html).toContain("View my bookings");
    expect(t.html).toContain('/dashboard/bookings"');
    expect(t.html).toContain("Book better. Travel further.");
    expect(t.text).toContain("Marie D.");
    expect(t.text).not.toContain("<");
  });

  it("T-150 : bookingHostCancellation — version française par défaut", () => {
    const t = templates.bookingHostCancellation({
      hostFirstName: "Paul", bookingReference: "MBB-CANCEL", propertyName: "Villa X",
      guestName: "Marie D.", checkIn: "2026-09-01", checkOut: "2026-09-05",
      reason: "Annulation demandée", language: "fr",
    });
    expect(t.subject).toBe("Annulation de votre réservation MBB-CANCEL");
    expect(t.html).toContain("a été annulée");
    expect(t.html).toContain(">Voyageur<");
    expect(t.html).toContain("Motif : Annulation demandée");
    expect(t.html).toContain("Voir mes réservations");
    expect(t.html).toContain("Réservez mieux. Voyagez plus.");
    expect(t.html).not.toContain(">Guest<");
  });

  it("T-150 : bookingHostCancellation échappe les variables (anti-XSS)", () => {
    const t = templates.bookingHostCancellation({
      hostFirstName: "Paul", bookingReference: "MBB-X", propertyName: "Villa",
      guestName: "<img src=x onerror=alert(1)>", checkIn: "2026-09-01", checkOut: "2026-09-02",
      reason: "<b>r</b>", language: "en",
    });
    expect(t.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(t.html).toContain("&lt;img");
    expect(t.html).not.toContain("<b>r</b>");
  });

  it("T-171 : copies FR des gabarits éditables = DEFAULTS (détection custom)", () => {
    const s = mailStrings("fr");
    const d = DEFAULTS.emailTemplates;
    expect(s.verifySubject).toBe(d.emailVerification.subject);
    expect(s.verifyBody).toBe(d.emailVerification.body);
    expect(s.resetSubject).toBe(d.passwordReset.subject);
    expect(s.resetBody).toBe(d.passwordReset.body);
    expect(s.welcomeSubject).toBe(d.welcomeEmail.subject);
    expect(s.welcomeBody).toBe(d.welcomeEmail.body);
    expect(s.bookingConfirmSubject).toBe(d.bookingConfirmation.subject);
    expect(s.bookingConfirmBody).toBe(d.bookingConfirmation.body);
    expect(s.hostNotifSubject).toBe(d.bookingHostNotification.subject);
    expect(s.hostNotifBody).toBe(d.bookingHostNotification.body);
    expect(s.cancelSubject).toBe(d.bookingCancellation.subject);
    expect(s.cancelBody).toBe(d.bookingCancellation.body);
    expect(s.reminderSubject).toBe(d.bookingReminder.subject);
    expect(s.reminderBody).toBe(d.bookingReminder.body);
    expect(s.reviewSubject).toBe(d.reviewRequest.subject);
    expect(s.reviewBody).toBe(d.reviewRequest.body);
  });

  it("T-171 : DEFAULTS non custom → corps/sujet EN selon le destinataire", async () => {
    const verify = await templates.emailVerification({
      firstName: "John", url: "https://x/verify", language: "en",
    });
    expect(verify.subject).toBe("Verify your email — MyBestBooking");
    expect(verify.text).toContain("Thanks for creating");
    expect(verify.text).not.toContain("Bienvenue");
    expect(verify.text).not.toContain("Merci d'avoir créé");

    const reset = await templates.passwordReset({
      firstName: "John", url: "https://x/reset", language: "en",
    });
    expect(reset.subject).toMatch(/Reset your password/);
    expect(reset.text).toMatch(/1 hour/);
    expect(reset.text).not.toContain("1 heure");

    const welcome = await templates.welcomeEmail({
      firstName: "John", url: "https://x/dashboard", language: "en",
    });
    expect(welcome.subject).toMatch(/Welcome to MyBestBooking/);
    expect(welcome.text).not.toContain("Bonjour");
    expect(welcome.text).toContain("Hi John");

    const confirm = await templates.bookingConfirmation({
      firstName: "John", bookingReference: "MBB-EN", propertyName: "Hotel X",
      city: "Paris", checkIn: "2026-09-01", checkOut: "2026-09-03",
      total: "200.00", currency: "EUR", language: "en",
    });
    expect(confirm.subject).toBe("Booking confirmed MBB-EN");
    expect(confirm.text).toContain("Your booking is confirmed");
    expect(confirm.text).not.toContain("Votre réservation est confirmée");

    const host = await templates.bookingHostNotification({
      hostFirstName: "Paul", bookingReference: "MBB-HOST", propertyName: "Villa X",
      guestName: "Marie D.", checkIn: "2026-09-01", checkOut: "2026-09-05", language: "en",
    });
    expect(host.subject).toBe("New booking MBB-HOST");
    expect(host.text).toContain("A new booking has just been confirmed");
    expect(host.text).not.toContain("Une nouvelle réservation");

    const cancel = await templates.bookingCancellation({
      firstName: "John", bookingReference: "MBB-C", propertyName: "Hotel X",
      cancellationFee: "10.00", currency: "EUR", language: "en",
    });
    expect(cancel.subject).toBe("Booking cancelled MBB-C");
    expect(cancel.text).toContain("Cancellation fee applied");
    expect(cancel.text).not.toContain("Frais d'annulation");

    const reminder = await templates.bookingReminder({
      firstName: "John", bookingReference: "MBB-REM", propertyName: "Hotel Y",
      city: "Douala", checkIn: "2026-09-10", checkOut: "2026-09-13",
      daysLabel: "Your arrival is in 3 days", url: "https://x/bookings", language: "en",
    });
    expect(reminder.subject).toBe("Your stay at Hotel Y is coming up (2026-09-10)");
    expect(reminder.text).toContain("Find booking MBB-REM");
    expect(reminder.text).not.toContain("Retrouvez votre réservation");

    const review = await templates.reviewRequest({
      firstName: "John", propertyName: "Hotel Z", bookingReference: "MBB-REV",
      url: "https://x/review", language: "en",
    });
    expect(review.subject).toBe("How was your stay at Hotel Z?");
    expect(review.text).toContain("Your review helps other travellers");
    expect(review.text).not.toContain("Votre avis aide");
  });

  it("T-171 : personnalisation admin d'un gabarit n'est pas auto-traduite", async () => {
    settingsMock.getSetting.mockResolvedValueOnce({
      ...DEFAULTS.emailTemplates,
      emailVerification: { subject: "Perso vérif {firstName}", body: "Corps FR perso {firstName}" },
    });
    const t = await templates.emailVerification({
      firstName: "John", url: "https://x/verify", language: "en",
    });
    expect(t.subject).toBe("Perso vérif John");
    expect(t.text).toContain("Corps FR perso John");
    expect(t.html).toContain("Verify my email");
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
