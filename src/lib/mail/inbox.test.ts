import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("isDevMailInboxEnabled", () => {
  it("MAIL_INBOX=1 reste actif même avec RESEND_API_KEY", async () => {
    const prevResend = process.env.RESEND_API_KEY;
    const prevInbox = process.env.MAIL_INBOX;
    process.env.RESEND_API_KEY = "re_x";
    process.env.MAIL_INBOX = "1";
    const { isDevMailInboxEnabled } = await import("./inbox");
    expect(isDevMailInboxEnabled()).toBe(true);
    if (prevResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResend;
    if (prevInbox === undefined) delete process.env.MAIL_INBOX;
    else process.env.MAIL_INBOX = prevInbox;
  });
});
