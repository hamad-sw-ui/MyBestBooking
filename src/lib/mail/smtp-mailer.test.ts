import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const sendMail = vi.fn(async () => ({ messageId: "<smtp-test@localhost>" }));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail }),
  },
}));

describe("SmtpMailer", () => {
  beforeEach(() => {
    sendMail.mockClear();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });
  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it("smtpFromEnv retourne null si incomplet", async () => {
    const { smtpFromEnv } = await import("./smtp-mailer");
    expect(smtpFromEnv()).toBeNull();
  });

  it("envoie via nodemailer (mock)", async () => {
    const { SmtpMailer } = await import("./smtp-mailer");
    const m = new SmtpMailer("smtp.gmail.com", 587, "a@gmail.com", "app-pass", "MyBestBooking <a@gmail.com>");
    const r = await m.send({
      to: "hamadamin399@gmail.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(r.id).toContain("smtp-test");
    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: "hamadamin399@gmail.com",
      subject: "Test",
    });
  });
});
