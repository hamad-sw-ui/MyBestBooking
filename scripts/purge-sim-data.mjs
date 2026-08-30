#!/usr/bin/env node
/**
 * T-159 (audit n°29) — Purge des artefacts de simulation hors vues métier.
 *
 * Les runs de `run_all_sims.py` laissent des réservations/users de test
 * (`%@t.local`, prénoms des scénarios) qui polluent les dashboards hôte
 * (« Gdpr Test », « Calc Test »…) et s'accumulent en base.
 *
 * Usage :
 *   node scripts/purge-sim-data.mjs          # --dry-run (affiche, ne supprime pas)
 *   node scripts/purge-sim-data.mjs --apply  # purge réellement
 *
 * Ordre FK : messages → conversations/sessions/verification_tokens →
 * review_votes/reviews/price_alerts/bookings → wishlist_items/wishlists →
 * users. Le smoke garde son nettoyage réentrant ; ce script est un filet
 * de sécurité pour les environnements partagés/démo.
 */
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db";
const APPLY = process.argv.includes("--apply");

const GUEST_NAMES = [
  "Racer", "ParaFix", "RaceFix", "Trans", "Calc", "Wallet", "Anonymous",
  "Blocked", "Deep", "Sim", "BlockTest", "FreeTest", "Combo", "Simulation",
  "Delete", "Verify", "Reset", "Gdpr", "Suspend", "Cookie", "Emoji", "Long",
  "Xss", "Smoke", "Audit",
];

const c = new Client({ connectionString: DATABASE_URL });

async function counts(sql, params = []) {
  const r = await c.query(sql, params);
  return r.rows;
}

async function main() {
  await c.connect();
  console.log(`🔎 purge-sim-data — ${APPLY ? "APPLY" : "DRY-RUN"} (--apply pour exécuter)\n`);

  // 1) Utilisateurs de test (sims) — adresses jetables.
  const simUsers = await counts(
    `SELECT id, email FROM users WHERE email ILIKE '%@t.local' OR email ILIKE '%@test.local' OR email ILIKE '%@anonymized.local'`,
  );
  const simIds = simUsers.map((u) => u.id);

  // 2) Réservations de scénarios (guest_first_name des runs + utilisateurs sims).
  const simBookings = await counts(
    `SELECT b.id, b.booking_reference FROM bookings b
       LEFT JOIN users u ON u.id = b.user_id
     WHERE (u.email ILIKE '%@t.local' OR u.email ILIKE '%@test.local' OR u.email ILIKE '%@anonymized.local')
        OR b.guest_first_name = ANY($1)`,
    [GUEST_NAMES],
  );
  const bookingIds = simBookings.map((b) => b.id);

  console.log(`  users de test        : ${simUsers.length}`);
  console.log(`  réservations de test : ${simBookings.length}`);
  if (bookingIds.length) {
    console.log("  exemples:", simBookings.slice(0, 5).map((b) => b.booking_reference).join(", "));
  }
  if (!APPLY) {
    console.log("\nℹ️  Rien supprimé (dry-run). Relancer avec --apply pour purger.");
    await c.end();
    return;
  }

  // FK : conversations/messages d'abord.
  await c.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE booking_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[]))`, [bookingIds.length ? bookingIds : [null], simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM conversations WHERE booking_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`, [bookingIds.length ? bookingIds : [null], simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM verification_tokens WHERE user_id = ANY($1::uuid[])`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM review_votes WHERE review_id IN (SELECT id FROM reviews WHERE user_id = ANY($1::uuid[]))`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM reviews WHERE user_id = ANY($1::uuid[])`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM price_alerts WHERE user_id = ANY($1::uuid[])`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM bookings WHERE id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`, [bookingIds.length ? bookingIds : [null], simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM wishlist_items WHERE wishlist_id IN (SELECT id FROM wishlists WHERE user_id = ANY($1::uuid[]))`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM wishlists WHERE user_id = ANY($1::uuid[])`, [simIds.length ? simIds : [null]]);
  await c.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [simIds.length ? simIds : [null]]);

  const left = await counts(
    `SELECT (SELECT count(*)::int FROM users WHERE email ILIKE '%@t.local' OR email ILIKE '%@test.local') AS users,
            (SELECT count(*)::int FROM bookings b LEFT JOIN users u ON u.id = b.user_id
             WHERE u.email ILIKE '%@t.local' OR b.guest_first_name = ANY($1)) AS bookings`,
    [GUEST_NAMES],
  );
  console.log(`\n✅ Purge appliquée — restants : users=${left[0].users} bookings=${left[0].bookings}`);
  await c.end();
}

main().catch((e) => {
  console.error("❌ purge-sim-data:", e.message);
  process.exit(1);
});
