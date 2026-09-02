require('dotenv').config({ path: '.env.local', quiet: true });
const { Client } = require('pg');
(async () => {
  const c = new Client(process.env.DATABASE_URL);
  await c.connect();
  const uid = await c.query("SELECT id FROM users WHERE email='customer@mybestbooking.com'");
  const prop = await c.query("SELECT id, host_id FROM properties WHERE is_bestrewards = true AND status='active' LIMIT 1");
  const room = await c.query("SELECT id, currency FROM rooms WHERE property_id=$1 AND is_active LIMIT 1", [prop.rows[0].id]);
  const b = await c.query(`INSERT INTO bookings (id, booking_reference, user_id, property_id, room_id, status, check_in, check_out, num_nights, num_adults, guest_first_name, guest_last_name, guest_email, subtotal, taxes, fees, discount, total, currency, payment_status, commission_rate, commission_amount, net_to_host, created_at, updated_at)
    VALUES (gen_random_uuid(), 'MBB-2026-CRON01', $1, $2, $3, 'confirmed', '2026-08-25', '2026-08-27', 2, 2, 'Audit', 'Cron', 'customer@mybestbooking.com', '200.00', '0', '0', '0', '200.00', $4, 'paid', '0.10', '20.00', '180.00', now(), now()) RETURNING id`,
    [uid.rows[0].id, prop.rows[0].id, room.rows[0].id, room.rows[0].currency ?? 'EUR']);
  console.log('booking passé id=', b.rows[0].id);
  const w0 = await c.query("SELECT wallet_balance::text wb, bestrewards_level lvl, bestrewards_bookings_count cnt, referred_by FROM users WHERE id=$1", [uid.rows[0].id]);
  console.log('avant:', JSON.stringify(w0.rows[0]));
  const pa = await c.query(`INSERT INTO price_alerts (id, user_id, property_id, max_price, check_in, check_out, notified_price, created_at) VALUES (gen_random_uuid(), $1, $2, 300, '2027-06-01', '2027-06-03', NULL, now()) ON CONFLICT (user_id, property_id) DO NOTHING RETURNING id`, [uid.rows[0].id, prop.rows[0].id]).catch(async e => {
    const cols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='price_alerts'");
    console.log('colonnes price_alerts:', cols.rows.map(x=>x.column_name).join(','));
    return { rows: [] };
  });
  console.log('price alert id:', pa.rows[0]?.id ?? '(cf colonnes)');
  await c.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
