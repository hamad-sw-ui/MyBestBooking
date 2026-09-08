import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settingsMock = vi.hoisted(() => ({ getSetting: vi.fn() }));
vi.mock("@/lib/settings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings")>("@/lib/settings");
  settingsMock.getSetting.mockImplementation(async (key: string) => {
    // @ts-expect-error accès dynamique DEFAULTS
    return actual.DEFAULTS[key];
  });
  return { ...actual, getSetting: settingsMock.getSetting };
});

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ConsoleMailer, templates } from "./index";

/**
 * Pipeline mail 100 % test : aucun Resend.
 * Chaque template transactionnel est rendu puis écrit par ConsoleMailer,
 * puis relu depuis le fichier (même contrat que les sims .data/mails).
 */
describe("pipeline mail tests (ConsoleMailer)", () => {
  let dir: string;
  let mailer: ConsoleMailer;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "mbb-mail-pipeline-"));
    mailer = new ConsoleMailer(dir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function readOnlyMail(): string {
    const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
    expect(files).toHaveLength(1);
    return readFileSync(join(dir, files[0]), "utf8");
  }

  it("vérification email : fichier contient To, sujet, lien token", async () => {
    const url = "http://localhost:3000/api/auth/verify?token=tok-verify-abc";
    const mail = await templates.emailVerification({
      firstName: "Awa",
      url,
      language: "fr",
    });
    await mailer.send({ to: "awa@test.local", ...mail, idempotencyKey: "email-verification:u1" });
    const file = readOnlyMail();
    expect(file).toContain("To: awa@test.local");
    expect(file).toContain("Subject:");
    expect(file).toContain("Awa");
    expect(file).toContain(url);
    expect(file).toMatch(/tok-verify-abc/);
  });

  it("reset mot de passe : lien /reinitialiser?token=", async () => {
    const url = "http://localhost:3000/reinitialiser?token=tok-reset-xyz";
    const mail = await templates.passwordReset({ firstName: "Jean", url, language: "fr" });
    await mailer.send({ to: "jean@test.local", ...mail, idempotencyKey: "password-reset:u2" });
    const file = readOnlyMail();
    expect(file).toContain("To: jean@test.local");
    expect(file).toContain(url);
    expect(file).toMatch(/1 heure/);
  });

  it("welcome + confirmation + annulation + rappel + avis + message + hôte", async () => {
    const cases: { key: string; to: string; mail: { subject: string; html: string; text: string }; needle: string }[] = [
      {
        key: "welcome:u",
        to: "w@test.local",
        mail: await templates.welcomeEmail({ firstName: "Awa", url: "http://localhost:3000/dashboard" }),
        needle: "http://localhost:3000/dashboard",
      },
      {
        key: "booking-confirmation:b:guest",
        to: "g@test.local",
        mail: await templates.bookingConfirmation({
          firstName: "Jean", bookingReference: "MBB-PIPE", propertyName: "Hôtel Test",
          city: "Douala", checkIn: "2026-10-01", checkOut: "2026-10-03",
          total: "120.00", currency: "EUR",
        }),
        needle: "MBB-PIPE",
      },
      {
        key: "booking-cancellation:b",
        to: "g@test.local",
        mail: await templates.bookingCancellation({
          firstName: "Jean", bookingReference: "MBB-PIPE", propertyName: "Hôtel Test",
          cancellationFee: "0.00", currency: "EUR",
        }),
        needle: "MBB-PIPE",
      },
      {
        key: "booking-reminder:b:j3",
        to: "g@test.local",
        mail: await templates.bookingReminder({
          firstName: "Jean", bookingReference: "MBB-PIPE", propertyName: "Hôtel Test",
          city: "Douala", checkIn: "2026-10-01", checkOut: "2026-10-03",
          daysLabel: "Votre arrivée est dans 3 jours", url: "http://localhost:3000/mes-reservations",
        }),
        needle: "dans 3 jours",
      },
      {
        key: "review-request:b",
        to: "g@test.local",
        mail: await templates.reviewRequest({
          firstName: "Jean", propertyName: "Hôtel Test", bookingReference: "MBB-PIPE",
          url: "http://localhost:3000/mes-reservations/avis/b1",
        }),
        needle: "/mes-reservations/avis/b1",
      },
      {
        key: "new-message:c1",
        to: "h@test.local",
        mail: await templates.newMessage({
          firstName: "Paul", senderName: "Jean", url: "http://localhost:3000/messages/c1",
        }),
        needle: "/messages/c1",
      },
      {
        key: "booking-host:b",
        to: "h@test.local",
        mail: await templates.bookingHostNotification({
          hostFirstName: "Paul", bookingReference: "MBB-PIPE", propertyName: "Hôtel Test",
          guestName: "Jean D.", checkIn: "2026-10-01", checkOut: "2026-10-03",
        }),
        needle: "Jean D.",
      },
    ];

    for (const c of cases) {
      await mailer.send({ to: c.to, ...c.mail, idempotencyKey: c.key });
      const path = join(dir, `console_${require("node:crypto").createHash("sha256").update(c.key).digest("hex").slice(0, 24)}.txt`);
      const content = readFileSync(path, "utf8");
      expect(content).toContain(`To: ${c.to}`);
      expect(content).toContain(`Subject: ${c.mail.subject}`);
      expect(content).toContain(c.needle);
    }
    expect(readdirSync(dir).filter((f) => f.endsWith(".txt"))).toHaveLength(cases.length);
  });

  it("idempotence : même eventKey = un seul fichier", async () => {
    const mail = { to: "x@test.local", subject: "s", html: "<p>h</p>", text: "h", idempotencyKey: "same-key" };
    await mailer.send(mail);
    await mailer.send(mail);
    expect(readdirSync(dir).filter((f) => f.endsWith(".txt"))).toHaveLength(1);
  });
});
