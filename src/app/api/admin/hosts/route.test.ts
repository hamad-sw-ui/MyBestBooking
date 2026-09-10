import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, like, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  properties,
  rooms,
  auditLog,
  sessions,
  verificationTokens,
} from "@/db/schema";

/**
 * Test d'intégration POST/PATCH/GET /api/admin/hosts (T-202, étendu T-215).
 * Utilise le serveur HTTP live (:3000) si présent, sinon skip.
 *
 * T-215 ajoute :
 *  - `action: "updateCommission"` (édition du taux d'un hôte déjà approuvé,
 *    `null` = retour à l'héritage global, propagation opt-in explicite),
 *  - `GET /api/admin/hosts/[id]` (aperçu d'impact en lecture seule),
 *  - le compteur `propertyCount` de la liste (sous-requête corrélée qualifiée).
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

let ADMIN = "";
let CUSTOMER = "";

serverTest("T-202 — validation hôte par l'admin + gate de publication", () => {
  let adminSession: string | null = null;
  let createdHostEmail: string | null = null;
  let createdHostId: string | null = null;
  let gatePropertyId: string | null = null;
  let gateHostId: string | null = null;

  beforeAll(async () => {
    adminSession = await login("admin@mybestbooking.com", "Admin123!");
    ADMIN = adminSession ?? "";
    CUSTOMER = (await login("customer@mybestbooking.com", "Customer123!")) ?? "";
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
    // Nettoyage réel (l'ancien appel visait /api/admin/bulk avec un contrat
    // obsolète → les hôtes de test s'accumulaient en base). On supprime les
    // comptes @test.local et leurs dépendances via la base.
    if (!serverAvailable) return;
    try {
      // Périmètre strict : uniquement les comptes créés par ce fichier
      // (`host-t202…@test.local`) — jamais les autres fixtures du dépôt.
      const testHosts = await db
        .select({ id: users.id })
        .from(users)
        .where(like(users.email, "host-t202%"));
      const ids = testHosts.map((h) => h.id);
      if (ids.length > 0) {
        const props = await db
          .select({ id: properties.id })
          .from(properties)
          .where(inArray(properties.hostId, ids));
        const propIds = props.map((p) => p.id);
        if (propIds.length > 0) {
          const hostRooms = await db
            .select({ id: rooms.id })
            .from(rooms)
            .where(inArray(rooms.propertyId, propIds));
          if (hostRooms.length > 0) {
            await db.delete(rooms).where(inArray(rooms.id, hostRooms.map((r) => r.id)));
          }
          await db.delete(properties).where(inArray(properties.id, propIds));
        }
        // L'inscription émet un jeton de vérification : sans lui, la
        // suppression du compte viole la FK `verification_tokens.user_id`.
        await db.delete(verificationTokens).where(inArray(verificationTokens.userId, ids));
        await db.delete(sessions).where(inArray(sessions.userId, ids));
        // Les entrées d'audit d'approbation ont pour acteur l'admin : on les
        // cible par entité (l'hôte de test) et non par acteur.
        await db.delete(auditLog).where(inArray(auditLog.entityId, ids));
        await db.delete(auditLog).where(inArray(auditLog.actorId, ids));
        await db.delete(users).where(inArray(users.id, ids));
      }
    } catch (cleanupError) {
      console.error("[t202] cleanup failed:", cleanupError);
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
    gateHostId = host2Id ?? null;
    const host2Session = await login(email2, "Hostpass123!");

    // L'hôte crée un hébergement (statut pending)
    const propCreate = await fetch("http://127.0.0.1:3000/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `session=${host2Session}` },
      body: JSON.stringify({ name: `T202 Gate ${Date.now()}`, type: "hotel", city: "Paris", country: "FR" }),
    });
    const propBody = await propCreate.json().catch(() => ({}));
    const propId = propBody?.property?.id;
    gatePropertyId = propId ?? null;
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

  it("T-215 : propertyCount reflète réellement les hébergements de l'hôte", async () => {
    // Régression : la sous-requête corrélée non qualifiée (`"id"`) résolvait
    // `properties.host_id = properties.id` → compteur toujours à 0.
    expect(gateHostId).toBeTruthy();
    expect(gatePropertyId).toBeTruthy();
    const r = await fetch("http://127.0.0.1:3000/api/admin/hosts?status=pending", {
      headers: { cookie: `session=${adminSession}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    const found = body.hosts.find((h: { id: string }) => h.id === gateHostId);
    expect(found).toBeTruthy();
    expect(found.propertyCount).toBe(1);
  });
});

serverTest("T-215 — édition du taux de commission d'un hôte (hors approbation)", () => {
  let hostId = "";
  let hostEmail = "";
  let inheritPropertyId = "";
  let explicitPropertyId = "";

  beforeAll(async () => {
    ADMIN = ADMIN || (await login("admin@mybestbooking.com", "Admin123!")) || "";
    CUSTOMER = CUSTOMER || (await login("customer@mybestbooking.com", "Customer123!")) || "";
    if (!ADMIN || !serverAvailable) return;

    // Hôte approuvé (sans accès HTTP : on ne teste que l'API admin) avec un
    // hébergement qui hérite (commission_rate NULL) et un à taux explicite.
    hostEmail = `host-t212-${Date.now()}@test.local`;
    const [host] = await db
      .insert(users)
      .values({
        email: hostEmail,
        firstName: "T212",
        lastName: "Commission",
        role: "host",
        approvalStatus: "approved",
        language: "fr",
      })
      .returning();
    hostId = host.id;

    const { generateSlug } = await import("@/lib/utils");
    const [inheritProp] = await db
      .insert(properties)
      .values({
        hostId: host.id,
        name: `T212 Inherit ${Date.now()}`,
        slug: generateSlug(`t212-inherit-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
        commissionRate: null,
      })
      .returning();
    inheritPropertyId = inheritProp.id;

    const [explicitProp] = await db
      .insert(properties)
      .values({
        hostId: host.id,
        name: `T212 Explicit ${Date.now()}`,
        slug: generateSlug(`t212-explicit-${Date.now()}`),
        type: "hotel",
        city: "TestCity",
        country: "FR",
        status: "active",
        commissionRate: "15.00",
      })
      .returning();
    explicitPropertyId = explicitProp.id;
  });

  afterAll(async () => {
    if (!serverAvailable || !hostId) return;
    try {
      await db.delete(properties).where(eq(properties.hostId, hostId));
      // Audit : l'hôte (approbation, commission) *et* ses hébergements
      // (propagation), dont l'acteur reste l'admin.
      await db.delete(auditLog).where(
        inArray(auditLog.entityId, [hostId, inheritPropertyId, explicitPropertyId].filter(Boolean)),
      );
      await db.delete(users).where(eq(users.id, hostId));
    } catch (cleanupError) {
      console.error("[t212] cleanup failed:", cleanupError);
    }
  });

  function patch(body: Record<string, unknown>) {
    return fetch(`http://127.0.0.1:3000/api/admin/hosts/${hostId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: `session=${ADMIN}` },
      body: JSON.stringify(body),
    });
  }

  it("GET /api/admin/hosts/[id] expose l'impact sans rien modifier", async () => {
    const before = await db
      .select({ commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.id, inheritPropertyId));

    const r = await fetch(`http://127.0.0.1:3000/api/admin/hosts/${hostId}`, {
      headers: { cookie: `session=${ADMIN}` },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.host.email).toBe(hostEmail);
    expect(body.host.commissionRate).toBeNull();
    expect(body.inheritCount).toBe(1);
    expect(body.explicitCount).toBe(1);
    expect(body.propertyCount).toBe(2);
    expect(body.effectiveRate).toBe(body.globalRate);
    expect(body.properties.find((p: { id: string }) => p.id === explicitPropertyId).effectiveRate).toBe(15);

    const after = await db
      .select({ commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.id, inheritPropertyId));
    expect(after[0].commissionRate).toBe(before[0].commissionRate);
  });

  it("updateCommission fixe le taux d'un hôte déjà approuvé", async () => {
    const r = await patch({ action: "updateCommission", commissionRate: 12 });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.host.approvalStatus).toBe("approved");
    expect(Number(body.host.commissionRate)).toBeCloseTo(12, 2);
    expect(body.propertiesUpdated).toBe(0); // aucune propagation implicite

    const [row] = await db
      .select({ commissionRate: users.commissionRate, status: users.approvalStatus })
      .from(users)
      .where(eq(users.id, hostId));
    expect(Number(row.commissionRate)).toBeCloseTo(12, 2);
    expect(row.status).toBe("approved");

    // Traçabilité dédiée, distincte de l'approbation.
    const audit = await db
      .select({ action: auditLog.action, metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.entityId, hostId));
    const entry = audit.find((a) => a.action === "host.commission.update");
    expect(entry).toBeTruthy();
    expect((entry?.metadata as Record<string, unknown>)?.newRate).toBe("12.00");
  });

  it("propagation « inherited » : uniquement les hébergements sans taux explicite", async () => {
    const r = await patch({ action: "updateCommission", commissionRate: 9, applyTo: "inherited" });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.propertiesUpdated).toBe(1);

    const [inheritRow] = await db
      .select({ commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.id, inheritPropertyId));
    const [explicitRow] = await db
      .select({ commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.id, explicitPropertyId));
    expect(Number(inheritRow.commissionRate)).toBeCloseTo(9, 2);
    expect(Number(explicitRow.commissionRate)).toBeCloseTo(15, 2); // intact
  });

  it("propagation « listed » : uniquement les hébergements transmis", async () => {
    const r = await patch({
      action: "updateCommission",
      commissionRate: 7,
      applyTo: "listed",
      propertyIds: [explicitPropertyId],
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.propertiesUpdated).toBe(1);

    const [inheritRow] = await db
      .select({ commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.id, inheritPropertyId));
    const [explicitRow] = await db
      .select({ commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.id, explicitPropertyId));
    expect(Number(explicitRow.commissionRate)).toBeCloseTo(7, 2);
    expect(Number(inheritRow.commissionRate)).toBeCloseTo(9, 2); // intact
  });

  it("commissionRate=null remet l'hôte en héritage du taux global", async () => {
    const r = await patch({ action: "updateCommission", commissionRate: null });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.host.commissionRate).toBeNull();
  });

  it("refuse les taux hors bornes (400)", async () => {
    for (const invalid of [101, -1]) {
      const r = await patch({ action: "updateCommission", commissionRate: invalid });
      expect(r.status).toBe(400);
    }
  });

  it("refuse une propagation « listed » sans hébergement (400)", async () => {
    const r = await patch({ action: "updateCommission", commissionRate: 10, applyTo: "listed" });
    expect(r.status).toBe(400);
  });

  it("refuse un non-admin (403)", async () => {
    const r = await fetch(`http://127.0.0.1:3000/api/admin/hosts/${hostId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: `session=${CUSTOMER}` },
      body: JSON.stringify({ action: "updateCommission", commissionRate: 10 }),
    });
    expect(r.status).toBe(403);
  });

  it("refuse une cible qui n'est pas un hôte (400)", async () => {
    const r = await fetch(`http://127.0.0.1:3000/api/admin/hosts/${hostId.slice(0, -1)}${hostId.endsWith("0") ? "1" : "0"}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: `session=${ADMIN}` },
      body: JSON.stringify({ action: "updateCommission", commissionRate: 10 }),
    });
    expect(r.status).toBe(404);
  });

  it("conserve le contrat T-202 (approve/reject) intact", async () => {
    const reject = await patch({ action: "reject" });
    expect(reject.status).toBe(200);
    expect((await reject.json()).host.approvalStatus).toBe("rejected");

    const approve = await patch({ action: "approve", commissionRate: 21 });
    expect(approve.status).toBe(200);
    const body = await approve.json();
    expect(body.host.approvalStatus).toBe("approved");
    expect(Number(body.host.commissionRate)).toBeCloseTo(21, 2);
  });
});
