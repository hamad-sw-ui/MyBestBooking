import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));

describe("GET /api/auth/me", () => {
  it("expose approvalStatus pour un hôte et null pour les autres rôles", async () => {
    const { getCurrentUser } = await import("@/lib/auth");
    const { GET } = await import("./route");

    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: "host-1",
      email: "host@example.test",
      firstName: "Hôte",
      lastName: "Test",
      phone: null,
      country: "FR",
      language: "fr",
      currency: "EUR",
      role: "host",
      approvalStatus: "rejected",
      bestrewardsLevel: 1,
      bestrewardsBookingsCount: 0,
      walletBalance: "0.00",
      emailVerified: true,
      twoFactorEnabled: false,
      timezone: "UTC",
      priceAlertEnabled: false,
      avatarUrl: null,
    } as never);

    const hostResponse = await GET();
    expect(hostResponse.status).toBe(200);
    await expect(hostResponse.json()).resolves.toMatchObject({
      user: { role: "host", approvalStatus: "rejected" },
    });

    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      id: "customer-1",
      email: "customer@example.test",
      firstName: "Client",
      lastName: "Test",
      role: "customer",
      approvalStatus: "pending",
    } as never);

    const customerResponse = await GET();
    await expect(customerResponse.json()).resolves.toMatchObject({
      user: { role: "customer", approvalStatus: null },
    });
  });
});
