import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendMailer } from "./resend-mailer";

describe("ResendMailer (tests, fetch mocké — aucun appel réseau réel)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST /emails avec from, to, subject, html, text et Idempotency-Key", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "re_msg_test_1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const mailer = new ResendMailer("re_test_key", "Tests <no-reply@test.local>");
    const result = await mailer.send({
      to: "guest@test.local",
      subject: "Sujet test",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "email-verification:user-1",
    });

    expect(result.id).toBe("re_msg_test_1");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Idempotency-Key"]).toBe("email-verification:user-1");
    const body = JSON.parse(String(init.body)) as {
      from: string; to: string[]; subject: string; html: string; text: string;
    };
    expect(body.from).toBe("Tests <no-reply@test.local>");
    expect(body.to).toEqual(["guest@test.local"]);
    expect(body.subject).toBe("Sujet test");
    expect(body.html).toBe("<p>Hello</p>");
    expect(body.text).toBe("Hello");
  });

  it("lève une erreur explicite si Resend répond 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("domain not verified", { status: 403 })),
    );
    const mailer = new ResendMailer("re_test_key");
    await expect(
      mailer.send({ to: "a@b.c", subject: "x", html: "x", text: "x" }),
    ).rejects.toThrow(/Resend send failed: HTTP 403/);
  });
});
