require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const uid = await c.query("SELECT id FROM users WHERE email='customer@mybestbooking.com'");
  const prop = await c.query("SELECT id FROM properties WHERE is_bestrewards = true AND status='active' LIMIT 1");
  const pa = await c.query(`INSERT INTO price_alerts (user_id, property_id, max_price, check_in, check_out, active, currency, created_at)
    VALUES ($1, $2, 300, '2027-06-01', '2027-06-03', true, 'EUR', now())
    ON CONFLICT (user_id, property_id) DO NOTHING RETURNING id`, [uid.rows[0].id, prop.rows[0].id]);
  console.log('alerte prix id:', pa.rows[0]?.id ?? 'déjà présente');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
