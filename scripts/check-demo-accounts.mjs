import { Client } from "pg";
const c = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/app_db" });
c.connect().then(async () => {
  const r = await c.query("SELECT email, role, deleted_at, two_factor_enabled FROM users WHERE email IN ($1, $2, $3)", ["admin@mybestbooking.com", "host@mybestbooking.com", "customer@mybestbooking.com"]);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}).catch(e => console.error(e.message));
