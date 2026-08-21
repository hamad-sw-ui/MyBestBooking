import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, safeMeta } from "./logger";

describe("logger (T-028)", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("info écrit du JSON sur stdout", () => {
    logger.info("hello", { userId: "u1" });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.userId).toBe("u1");
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("error écrit sur stderr", () => {
    logger.error("boom", { code: 500 });
    expect(errSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("error");
    expect(parsed.code).toBe(500);
  });

  it("warn utilise stderr aussi", () => {
    logger.warn("caution");
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it("debug utilise stdout", () => {
    logger.debug("trace");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});

describe("safeMeta (T-028)", () => {
  it("redacte les clés sensibles", () => {
    const r = safeMeta({
      userId: "u1",
      password: "s3cret",
      apiKey: "sk_live_x",
      authToken: "t123",
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      SECRET: "xyz",
      name: "Marie",
    });
    expect(r.userId).toBe("u1");
    expect(r.name).toBe("Marie");
    expect(r.password).toBe("[redacted]");
    expect(r.apiKey).toBe("[redacted]");
    expect(r.authToken).toBe("[redacted]");
    expect(r.SECRET).toBe("[redacted]");
  });
});
