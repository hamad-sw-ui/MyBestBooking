import { afterEach, describe, expect, it, vi } from "vitest";
import { reportSilentFetchIssue, resetSilentFetchReportsForTests } from "./silent-fetch-observability";

describe("T-209/F7 — observabilité des fetchs silencieux", () => {
  afterEach(() => {
    resetSilentFetchReportsForTests();
    vi.restoreAllMocks();
  });

  it("trace une erreur 401 en info sans la répéter", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    reportSilentFetchIssue("unread-messages-badge", { status: 401 });
    reportSilentFetchIssue("unread-messages-badge", { status: 401 });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain("unread-messages-badge");
  });

  it("trace les erreurs réseau en warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    reportSilentFetchIssue("maintenance-gate", { error: new Error("network down") });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("maintenance-gate");
  });
});
