require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const u = await c.query("SELECT wallet_balance::text wb, bestrewards_level lvl, bestrewards_bookings_count cnt FROM users WHERE email='customer@mybestbooking.com'");
  console.log('customer après cron:', JSON.stringify(u.rows[0]), '(avant: wb=25.00 lvl=2 cnt=7)');
  const b = await c.query("SELECT status, loyalty_awarded_at IS NOT NULL awarded, cashback_amount::text cbk FROM bookings WHERE booking_reference='MBB-2026-CRON01'");
  console.log('booking CRON01:', JSON.stringify(b.rows[0]));
  const m = await c.query('SELECT subject, "to", status FROM email_outbox ORDER BY created_at DESC LIMIT 3');
  m.rows.forEach(x => console.log(x.status, '|', x.subject, '→', x.to));
  const pa = await c.query("SELECT last_notified_at IS NOT NULL notified, last_notified_price::text FROM price_alerts WHERE user_id=(SELECT id FROM users WHERE email='customer@mybestbooking.com') LIMIT 1");
  console.log('price alert state:', JSON.stringify(pa.rows[0]));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
