require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const r = await c.query(`SELECT p.id pid, p.slug, r.id rid FROM properties p JOIN rooms r ON r.property_id=p.id WHERE p.is_bestrewards AND p.status='active' AND r.is_active ORDER BY r.quantity DESC LIMIT 1`);
  console.log(JSON.stringify(r.rows[0]));
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
