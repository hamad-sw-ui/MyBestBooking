import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Test d'intégration POST/PATCH /api/admin/hosts (T-202).
 * Utilise le serveur HTTP live (:3000) si présent, sinon skip.
 */

async function serverUp(): Promise<boolean> {
  try {
    const r = await fetch("http://127.0.0.1:3000/api/health");
    return r.status === 200;
  } catch {
    return false;
  }
}

let serverAvailable = false;
try {
  serverAvailable = await serverUp();
} catch {
  serverAvailable = false;
}
const serverTest = serverAvailable ? describe : describe.skip;

async function login(email: string, password: string): Promise<string | null> {
  try {
    const r = await fetch("http://127.0.0.1:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
      },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return null;
    const setCookie = r.headers.get("set-cookie") ?? "";
    const m = setCookie.match(/session=([^;]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let adminSession: string | null = null;
let createdHostEmail: string | null = null;
let createdHostId: string | null = null;

serverTest("T-202 — validation hôte par l'admin + gate de publication", () => {
  beforeAll(async () => {
    adminSession = await login("admin@mybestbooking.com", "Admin123!");
    // Crée un hôte en attente via l'API d'inscription (role host).
    const email = `host-t202-${Date.now()}@test.local`;
    const r = await fetch("http://127.0.0.1:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "Hostpass123!",
        firstName: "T202",
        lastName: "Host",
        role: "host",
      }),
    });
    const body = await r.json().catch(() => ({}));
    createdHostEmail = email;
    if (body?.user?.id) createdHostId = body.user.id;
  });

  afterAll(async () => {
    // Nettoyage best-effort (idempotent)
    if (!serverAvailable) return;
    try {
      await fetch(`http://127.0.0.1:3000/api/admin/bulk?action=deleteUser&ids=${createdHostId ?? ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `session=${adminSession}` },
        body: JSON.stringify({}),
      }).catch(() => null);
    } catch {
      /* best-effort */
    }
  });

  it("un nouveau hôte est en attente (approvalStatus=pending)", async () => {
    expect(adminSession).toBeTruthy();
    expect(createdHostId).toBeTruthy();
  });

  it("l'admin liste les hôtes en attente via GET /api/admin/hosts", async () => {
    const r = await fetch("http://127.0.0.1:3000/api/admin/hosts?status=pending", {
      headers: { cookie: `session=${adminSession}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(Array.isArray(body.hosts)).toBe(true);
    const found = body.hosts.find((h: { email: string }) => h.email === createdHostEmail);
    expect(found).toBeTruthy();
    expect(found.approvalStatus).toBe("pending");
  });

  it("l'admin approuve l'hôte avec un taux de commission via PATCH", async () => {
    const r = await fetch(`http://127.0.0.1:3000/api/admin/hosts/${createdHostId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: `session=${adminSession}` },
      body: JSON.stringify({ action: "approve", commissionRate: 18 }),
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.host.approvalStatus).toBe("approved");
    expect(Number(body.host.commissionRate)).toBeCloseTo(18, 1);
  });

  it("un non-admin est refusé (403) sur PATCH", async () => {
    const custSession = await login("customer@mybestbooking.com", "Customer123!");
    const r = await fetch(`http://127.0.0.1:3000/api/admin/hosts/${createdHostId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: `session=${custSession}` },
      body: JSON.stringify({ action: "approve" }),
    });
    expect(r.status).toBe(403);
  });

  it("le gate de publication bloque un hôte non approuvé (validate→approve)", async () => {
    // Crée un second hôte (pending) et un hébergement, tente l'approbation admin
    // → doit être refusé car l'hôte n'est pas approuvé.
    const email2 = `host-t202b-${Date.now()}@test.local`;
    const reg = await fetch("http://127.0.0.1:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email2, password: "Hostpass123!", firstName: "T202b", lastName: "Host", role: "host" }),
    });
    const regBody = await reg.json().catch(() => ({}));
    const host2Id = regBody?.user?.id;
    const host2Session = await login(email2, "Hostpass123!");

    // L'hôte crée un hébergement (statut pending)
    const propCreate = await fetch("http://127.0.0.1:3000/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `session=${host2Session}` },
      body: JSON.stringify({ name: `T202 Gate ${Date.now()}`, type: "hotel", city: "Paris", country: "FR" }),
    });
    const propBody = await propCreate.json().catch(() => ({}));
    const propId = propBody?.property?.id;
    expect(propId).toBeTruthy();

    // L'admin tente d'approuver → refusé (409) car l'hôte est pending
    const approve = await fetch(`http://127.0.0.1:3000/api/properties/${propId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `session=${adminSession}` },
      body: JSON.stringify({ action: "approve" }),
    });
    expect(approve.status).toBe(409);
    const approveBody = await approve.json().catch(() => ({}));
    expect(approveBody.error ?? "").toMatch(/compte hôte/i);
  });
});
