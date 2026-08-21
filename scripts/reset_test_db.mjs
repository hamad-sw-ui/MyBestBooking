#!/usr/bin/env node
/**
 * Reset la DB aux valeurs seed sans re-seeder tout — utilitaire pour
 * les runs de simulation (assure que chaque suite démarre proprement).
 *
 * - Nettoie les properties créées par les tests (Deep Villa, Race, Sim…)
 *   et toutes leurs FK dépendantes.
 * - Restore le customer seed (2FA off, wallet 25€, BR level 2).
 * - Retire les 2FA activés sur les comptes seed.
 * - Restore le statut des reviews à 'approved' (au cas où les tests
 *   les auraient mis en 'hidden').
 *
 * Usage : node scripts/reset_test_db.mjs
 */
import { Client } from "pg";

const c = new Client({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
});

await c.connect();

// 1. Cleanup properties test
const testProps = (
  await c.query(
    "SELECT id FROM properties WHERE name LIKE 'Deep Villa%' OR name LIKE 'Race%' OR name LIKE 'Sim%' OR name LIKE 'Test%' OR name LIKE 'BulkTest%' OR name LIKE 'Dash%' OR name LIKE 'T034%'",
  )
).rows.map((r) => r.id);

if (testProps.length > 0) {
  await c.query("DELETE FROM price_alerts WHERE property_id = ANY($1)", [testProps]);
  await c.query("DELETE FROM wishlist_items WHERE property_id = ANY($1)", [testProps]);
  await c.query("DELETE FROM reviews WHERE property_id = ANY($1)", [testProps]);
  await c.query("DELETE FROM bookings WHERE property_id = ANY($1)", [testProps]);
  await c.query("DELETE FROM conversations WHERE property_id = ANY($1)", [testProps]);
  await c.query(
    "DELETE FROM room_availability WHERE room_id IN (SELECT id FROM rooms WHERE property_id = ANY($1))",
    [testProps],
  );
  await c.query(
    "DELETE FROM rate_plans WHERE room_id IN (SELECT id FROM rooms WHERE property_id = ANY($1))",
    [testProps],
  );
  await c.query("DELETE FROM rooms WHERE property_id = ANY($1)", [testProps]);
  await c.query("DELETE FROM properties WHERE id = ANY($1)", [testProps]);
}
console.log(`✓ properties test supprimées : ${testProps.length}`);

// 2. Cleanup bookings de test récents (garde le seed originel intact)
const delBookings = await c.query(
  `DELETE FROM bookings WHERE guest_first_name IN
    ('Racer','ParaFix','RaceFix','Trans','Calc','Wallet','Anonymous',
     'Blocked','Deep','BlockTest','FreeTest','Combo','Simulation',
     'Delete','Verify','Reset','Gdpr','Suspend','Cookie','Emoji',
     'Long','Xss','ParaCancel','MetaTest','Dash','Bulk')
   OR guest_first_name LIKE 'Racer%'
   OR guest_first_name LIKE 'Trans%'
   OR guest_first_name LIKE 'Race%'
   OR guest_first_name LIKE 'Chevauchement%'
   OR guest_first_name LIKE 'Rate%'
   OR guest_first_name LIKE 'Wallet%'`,
);
console.log(`✓ bookings test supprimées : ${delBookings.rowCount}`);

// 3. Cleanup promotions test
await c.query(
  `DELETE FROM promotions WHERE code LIKE 'MIN200_%' OR code LIKE 'MAX1_%'
     OR code LIKE 'EXPIRED_%' OR code LIKE 'FUTURE_%' OR code LIKE 'SIMXTREME%'`,
);
console.log("✓ promotions test supprimées");

// 4. Sessions expirées des users test
await c.query(
  `DELETE FROM sessions WHERE user_id IN
    (SELECT id FROM users WHERE email LIKE '%@t.local' OR email LIKE '%@test.local' OR email LIKE '%@anonymized.local')`,
);
console.log("✓ sessions test supprimées");

// 5. Restore comptes seed
await c.query(
  "UPDATE users SET two_factor_enabled=false, two_factor_secret=null WHERE email LIKE '%@mybestbooking.com'",
);
await c.query(
  "UPDATE users SET wallet_balance='25.00', bestrewards_bookings_count=7, bestrewards_level=2 WHERE email='customer@mybestbooking.com'",
);
console.log("✓ comptes seed restaurés (2FA off, wallet 25€, BR level 2)");

// 6. Restore reviews approved
await c.query("UPDATE reviews SET status='approved' WHERE status IN ('hidden','rejected','pending')");
console.log("✓ reviews restaurés à 'approved'");

// 7. Restore promotion seed BIENVENUE10 active si elle existe
await c.query("UPDATE promotions SET is_active=true WHERE code='BIENVENUE10'");
console.log("✓ promo BIENVENUE10 réactivée");

await c.end();
console.log("\n✅ DB reset complet");
