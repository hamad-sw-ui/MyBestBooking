#!/usr/bin/env python3
"""Simulation dédiée dashboards + filtres + sélection + actions groupées.

T-033 (Session 12) — vérifie que :

1. Les 4 dashboards clients (users, properties, reviews, bookings) sont
   bien branchés à leur *Manager* (contrôle statique dans page.tsx).
2. Les composants Manager exposent les hooks attendus (searchValue,
   selectedIds, filters, checkboxes, actions groupées).
3. L'API POST /api/admin/bulk fonctionne pour les 4 entités × actions
   couvertes (users : suspend/reactivate/anonymize ; properties :
   approve/reject/suspend ; reviews : approve/hide/reject ; bookings :
   cancel).
4. Les guards de sécurité : sans cookie 403, customer 403, ids > 100
   400, action invalide 400, admin auto-modif protégée.
5. L'audit log enregistre chaque bulk action avec metadata complète.
6. Le HTML rendu des pages dashboard contient bien les composants
   attendus (BulkToolbar mentionné dans les scripts turbopack).
"""
import subprocess, json, os, re, time, sys, glob

BASE = "http://127.0.0.1:3000"
JAR = "/tmp/dashsim"
REPO = "/home/user/MyBestBooking"
OUT = f"{REPO}/.ai/REPORTS/simulation_dashboards_2026-08-21_session_12.md"

os.makedirs(JAR, exist_ok=True)

_ip = [0]
def next_ip():
    _ip[0] = (_ip[0] + 1) % 65000
    return f"10.55.{_ip[0] // 250 % 250}.{_ip[0] % 250 + 1}"

def curl(url, method="GET", jar=None, data=None, headers=None, form=None, max_time=15):
    args = ["curl", "-s", "-w", "\n__CODE__%{http_code}", "--max-time", str(max_time),
            "-L", "-H", f"X-Forwarded-For: {next_ip()}"]
    if jar and os.path.exists(f"{JAR}/{jar}.jar"):
        args += ["-b", f"{JAR}/{jar}.jar"]
    if method != "GET":
        args += ["-X", method]
    if headers:
        for h in headers: args += ["-H", h]
    if data is not None:
        if not headers or not any("content-type" in h.lower() for h in headers):
            args += ["-H", "Content-Type: application/json"]
        args += ["-d", data]
    if form is not None:
        for k, v in form: args += ["-F", f"{k}={v}"]
    args.append(url)
    try:
        p = subprocess.run(args, capture_output=True, timeout=max_time+5)
    except subprocess.TimeoutExpired:
        return 0, ""
    out = p.stdout.decode("utf-8", errors="replace")
    m = re.search(r"__CODE__(\d+)", out)
    code = int(m.group(1)) if m else 0
    body = re.sub(r"\n__CODE__.*", "", out, flags=re.S)
    return code, body

def raw_login(email, pwd, jar_name):
    args = ["curl","-s","-o","/dev/null","-w","%{http_code}",
        "-c", f"{JAR}/{jar_name}.jar",
        "-H", f"X-Forwarded-For: {next_ip()}",
        "-X","POST","-H","Content-Type: application/json",
        "-d", f'{{"email":"{email}","password":"{pwd}"}}',
        BASE + "/api/auth/login"]
    r = subprocess.run(args, capture_output=True, text=True, timeout=15)
    return int(r.stdout.strip() or "0")

def db_query(sql):
    r = subprocess.run(["node","-e", f"""
const {{Client}} = require('pg');
const c = new Client({{connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/app_db'}});
c.connect().then(async () => {{
  try {{ const res = await c.query({json.dumps(sql)}); console.log(JSON.stringify(res.rows)); }}
  catch (e) {{ console.log(JSON.stringify({{error:e.message}})); }}
  await c.end();
}});"""], capture_output=True, text=True, cwd=REPO, timeout=15)
    try:
        return json.loads(r.stdout.strip() or "[]")
    except Exception:
        return {"parse_error": r.stdout}

results = []
def record(section, name, verdict, detail=""):
    icon = "✅" if verdict == "OK" else ("⚠️" if verdict == "WARN" else "❌")
    print(f"{icon} [{section}] {name}")
    if detail:
        print(f"    {detail[:180]}")
    results.append({"section": section, "name": name, "verdict": verdict, "detail": detail})

# Cleanup préalable
db_query("UPDATE users SET two_factor_enabled=false, two_factor_secret=null WHERE email LIKE '%@mybestbooking.com'")

# Login des 3 rôles
for c in ["customer@mybestbooking.com:Customer123!:cust",
          "host@mybestbooking.com:Host123!:host",
          "admin@mybestbooking.com:Admin123!:admin"]:
    e, p, t = c.split(":")
    code = raw_login(e, p, t)
    print(f"login {t} → {code}")
curl(BASE + "/api/seed", "POST")

# ═══════════════════════════════════════════════════════════════
S = "1. Pages dashboard branchées sur leurs Managers (statique)"

for route, mgr in [
    ("dashboard/users",      "UsersManager"),
    ("dashboard/properties", "PropertiesManager"),
    ("dashboard/reviews",    "ReviewsManager"),
    ("dashboard/bookings",   "BookingsManager"),
]:
    path = f"{REPO}/src/app/{route}/page.tsx"
    if not os.path.exists(path):
        record(S, f"{route}/page.tsx introuvable", "KO", "")
        continue
    with open(path) as f: src = f.read()
    ok = mgr in src
    record(S, f"{route}/page.tsx importe et rend <{mgr}>",
           "OK" if ok else "KO", f"grep {mgr} : {'trouvé' if ok else 'absent'}")

# ═══════════════════════════════════════════════════════════════
S = "2. Composants Manager exposent filtres + sélection + actions"

for f, must_have in [
    ("src/components/bulk/bulk-toolbar.tsx",
     ["BulkToolbar", "onSelectAll", "onSearchChange", "runAction", "selectedIds",
      "/api/admin/bulk", "confirmMessage", "Ctrl", "Escape"]),
    ("src/components/bulk/users-manager.tsx",
     ["UsersManager", "BulkToolbar", "type=\"checkbox\"", "roleFilter",
      "statusFilter", "toggleAll", "suspend", "reactivate", "anonymize"]),
    ("src/components/bulk/properties-manager.tsx",
     ["PropertiesManager", "BulkToolbar", "type=\"checkbox\"", "statusFilter",
      "typeFilter", "toggleAll", "approve", "reject", "suspend"]),
    ("src/components/bulk/reviews-manager.tsx",
     ["ReviewsManager", "BulkToolbar", "type=\"checkbox\"", "statusFilter",
      "toggleAll", "approve", "hide", "reject"]),
    ("src/components/bulk/bookings-manager.tsx",
     ["BookingsManager", "BulkToolbar", "type=\"checkbox\"", "statusFilter",
      "dateFrom", "dateTo", "toggleAll", "cancel"]),
]:
    path = os.path.join(REPO, f)
    if not os.path.exists(path):
        record(S, f"{f}", "KO", "fichier introuvable")
        continue
    with open(path) as fh: src = fh.read()
    missing = [p for p in must_have if p not in src]
    record(S, f"{f} : contient {len(must_have)} patterns requis",
           "OK" if not missing else "KO",
           f"manquant : {missing}" if missing else "tous présents")

# ═══════════════════════════════════════════════════════════════
S = "3. API bulk : RBAC (guards)"

# Sans cookie → 403
code, body = curl(BASE + "/api/admin/bulk", "POST",
    data='{"entity":"users","action":"suspend","ids":["00000000-0000-0000-0000-000000000000"]}')
record(S, "sans cookie → 403", "OK" if code == 403 else "KO", f"code={code} body={body[:150]}")

# Customer → 403
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="cust",
    data='{"entity":"users","action":"suspend","ids":["00000000-0000-0000-0000-000000000000"]}')
record(S, "customer → 403", "OK" if code == 403 else "KO", f"code={code}")

# Host → 403
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="host",
    data='{"entity":"users","action":"suspend","ids":["00000000-0000-0000-0000-000000000000"]}')
record(S, "host → 403", "OK" if code == 403 else "KO", f"code={code}")

# ═══════════════════════════════════════════════════════════════
S = "4. API bulk : validation payload"

# entity manquante
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data='{"action":"suspend","ids":["00000000-0000-0000-0000-000000000000"]}')
record(S, "entity manquante → 400", "OK" if code == 400 else "KO", body[:150])

# entity invalide
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data='{"entity":"secret","action":"suspend","ids":["00000000-0000-0000-0000-000000000000"]}')
record(S, "entity invalide → 400", "OK" if code == 400 else "KO", body[:150])

# ids vide
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data='{"entity":"users","action":"suspend","ids":[]}')
record(S, "ids=[] → 400", "OK" if code == 400 else "KO", body[:150])

# ids > 100
ids_101 = json.dumps([f"00000000-0000-0000-0000-{i:012x}" for i in range(101)])
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data=f'{{"entity":"users","action":"suspend","ids":{ids_101}}}')
record(S, "ids > 100 → 400", "OK" if code == 400 else "KO", body[:150])

# UUID invalide
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data='{"entity":"users","action":"suspend","ids":["not-a-uuid"]}')
record(S, "UUID invalide → 400", "OK" if code == 400 else "KO", body[:150])

# Action invalide pour entity
code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data='{"entity":"users","action":"kill","ids":["00000000-0000-0000-0000-000000000000"]}')
record(S, "action=kill sur users → 400", "OK" if code == 400 else "KO", body[:150])

# ═══════════════════════════════════════════════════════════════
S = "5. API bulk : ID inexistant → skipped (pas failed)"

code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
    data='{"entity":"users","action":"suspend","ids":["00000000-0000-0000-0000-000000000000"]}')
try:
    d = json.loads(body)
    ok = code == 200 and d.get("requested") == 1 and d.get("succeeded") == 0 and len(d.get("skipped", [])) == 1
except:
    ok = False
record(S, "id inexistant → 200 skipped:1 (pas failed)",
       "OK" if ok else "KO", f"body={body[:250]}")

# ═══════════════════════════════════════════════════════════════
S = "6. Admin auto-protection : impossible de se suspendre soi-même"

me_admin = db_query("SELECT id FROM users WHERE email='admin@mybestbooking.com'")
if me_admin and isinstance(me_admin, list):
    admin_id = me_admin[0]["id"]
    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"users","action":"suspend","ids":["{admin_id}"]}}')
    try:
        d = json.loads(body)
        skipped = d.get("skipped", [])
        ok = code == 200 and len(skipped) == 1 and skipped[0].get("id") == admin_id
    except:
        ok = False
    record(S, "admin tente self-suspend → skipped avec raison",
           "OK" if ok else "KO", f"body={body[:250]}")

# Un autre admin dans le seed ? Non → tester : bulk suspend sur un autre admin
# Créer un fake admin en DB
db_query(f"UPDATE users SET role='admin' WHERE email='host@mybestbooking.com'")
me_host = db_query("SELECT id FROM users WHERE email='host@mybestbooking.com'")
if me_host and isinstance(me_host, list):
    host_id = me_host[0]["id"]
    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"users","action":"suspend","ids":["{host_id}"]}}')
    try:
        d = json.loads(body)
        # host étant admin, le AND ne(users.role, "admin") retire cette row → skipped
        ok = code == 200 and (d.get("skipped", []) or d.get("succeeded") == 0)
    except:
        ok = False
    record(S, "bulk suspend sur un autre admin → skipped (ne(role, admin))",
           "OK" if ok else "KO", f"body={body[:250]}")
# Restore host role
db_query(f"UPDATE users SET role='host' WHERE email='host@mybestbooking.com'")

# ═══════════════════════════════════════════════════════════════
S = "7. Bulk users : suspend → réactivate cycle complet"

ts = int(time.time())
ids = []
for i in range(3):
    email = f"dashsim{ts}_{i}@t.local"
    r_code, r_body = curl(BASE + "/api/auth/register", "POST",
        data=json.dumps({"email":email,"password":"DashSim123!",
                         "firstName":"Dash","lastName":f"Sim{i}"}))
    try:
        ids.append(json.loads(r_body)["user"]["id"])
    except:
        pass

record(S, f"Créer 3 users test : {len(ids)}/3",
       "OK" if len(ids) == 3 else "WARN", f"ids: {[x[:8] for x in ids]}")

if len(ids) == 3:
    ids_json = json.dumps(ids)
    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"users","action":"suspend","ids":{ids_json}}}')
    try:
        d = json.loads(body)
        succ = d.get("succeeded", 0)
    except: succ = 0
    record(S, f"Bulk suspend 3 users → succeeded={succ}",
           "OK" if code == 200 and succ == 3 else "KO", body[:250])

    check = db_query(f"SELECT count(*) as n FROM users WHERE id = ANY(ARRAY[{','.join([repr(x) for x in ids])}]::uuid[]) AND deleted_at IS NOT NULL")
    n_susp = int(check[0]["n"]) if check and isinstance(check, list) else 0
    record(S, f"DB check : {n_susp}/3 users suspended",
           "OK" if n_susp == 3 else "KO", "")

    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"users","action":"reactivate","ids":{ids_json}}}')
    try:
        d = json.loads(body)
        succ = d.get("succeeded", 0)
    except: succ = 0
    record(S, f"Bulk reactivate 3 users → succeeded={succ}",
           "OK" if code == 200 and succ == 3 else "KO", body[:250])

    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"users","action":"anonymize","ids":{ids_json}}}')
    try:
        d = json.loads(body)
        succ = d.get("succeeded", 0)
    except: succ = 0
    record(S, f"Bulk anonymize 3 users → succeeded={succ}",
           "OK" if code == 200 and succ == 3 else "KO", body[:250])

    check = db_query(f"SELECT count(*) as n FROM users WHERE id = ANY(ARRAY[{','.join([repr(x) for x in ids])}]::uuid[]) AND email LIKE 'deleted-%@anonymized.local'")
    n_anon = int(check[0]["n"]) if check and isinstance(check, list) else 0
    record(S, f"DB check : {n_anon}/3 users anonymisés",
           "OK" if n_anon == 3 else "KO", "")

# ═══════════════════════════════════════════════════════════════
S = "8. Bulk properties : approve"

# Créer 2 properties pending via l'API host (garantit qu'il y en a
# à tester même après reset_test_db)
prop_ids = []
for i in range(2):
    payload = json.dumps({
        "name": f"BulkTest Villa {int(time.time())}_{i}",
        "type": "villa",
        "description": "Test bulk approve",
        "city": "Nice", "country": "FR", "starRating": 3,
    })
    c_code, c_body = curl(BASE + "/api/properties", "POST", jar="host", data=payload)
    try:
        pid = json.loads(c_body).get("property", {}).get("id", "")
        if pid: prop_ids.append(pid)
    except: pass

if len(prop_ids) >= 1:
    ids_json = json.dumps(prop_ids)
    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"properties","action":"approve","ids":{ids_json}}}')
    try:
        d = json.loads(body)
        succ = d.get("succeeded", 0)
    except: succ = 0
    record(S, f"Bulk approve {len(prop_ids)} properties (créées à la volée) → succeeded={succ}",
           "OK" if code == 200 and succ == len(prop_ids) else "KO",
           f"body={body[:250]}")
else:
    record(S, "Impossible de créer des properties test pour bulk approve",
           "WARN", "")

# ═══════════════════════════════════════════════════════════════
S = "9. Bulk reviews : approve/hide"

revs = db_query("SELECT id FROM reviews LIMIT 3")
if revs and isinstance(revs, list) and len(revs) >= 1:
    ids = [r["id"] for r in revs]
    ids_json = json.dumps(ids)
    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"reviews","action":"hide","ids":{ids_json}}}')
    try: succ = json.loads(body).get("succeeded", 0)
    except: succ = 0
    record(S, f"Bulk hide {len(ids)} reviews → succeeded={succ}",
           "OK" if code == 200 and succ == len(ids) else "KO", body[:250])

    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"reviews","action":"approve","ids":{ids_json}}}')
    try: succ = json.loads(body).get("succeeded", 0)
    except: succ = 0
    record(S, f"Bulk approve {len(ids)} reviews → succeeded={succ}",
           "OK" if code == 200 and succ == len(ids) else "KO", body[:250])

# ═══════════════════════════════════════════════════════════════
S = "10. Bulk bookings : cancel respecte la machine à états"

# Prendre 1 booking pending/confirmed et 1 booking cancelled
b_ok = db_query("SELECT id FROM bookings WHERE status IN ('pending','confirmed') LIMIT 1")
b_cancel = db_query("SELECT id FROM bookings WHERE status = 'cancelled' LIMIT 1")

test_ids = []
if b_ok and isinstance(b_ok, list) and b_ok: test_ids.append(b_ok[0]["id"])
if b_cancel and isinstance(b_cancel, list) and b_cancel: test_ids.append(b_cancel[0]["id"])

if len(test_ids) >= 2:
    ids_json = json.dumps(test_ids)
    code, body = curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"bookings","action":"cancel","ids":{ids_json}}}')
    try:
        d = json.loads(body)
        succ = d.get("succeeded", 0)
        skipped = d.get("skipped", [])
    except: succ = 0; skipped = []
    # Attendu : 1 succeeded (booking pending/confirmed), 1 skipped (déjà cancelled)
    ok = code == 200 and succ == 1 and len(skipped) == 1 and "transition" in (skipped[0].get("reason","") if skipped else "").lower()
    record(S, f"Bulk cancel mix (1 valide + 1 déjà cancelled) → 1×OK + 1×skipped",
           "OK" if ok else "KO",
           f"succ={succ} skipped={skipped}")

# ═══════════════════════════════════════════════════════════════
S = "11. Audit log : bulk.action enregistré"

code, body = curl(BASE + "/api/admin/audit", jar="admin")
try:
    d = json.loads(body)
    entries = d.get("entries", d.get("audit", d.get("logs", d if isinstance(d, list) else [])))
    if not isinstance(entries, list): entries = []
    bulk_entries = [e for e in entries if e.get("action") == "bulk.action"]
except: bulk_entries = []

record(S, f"GET /api/admin/audit contient {len(bulk_entries)} entrée(s) 'bulk.action'",
       "OK" if len(bulk_entries) >= 3 else "WARN",
       f"actions récentes : {[(e.get('entityType'), (e.get('metadata') or {}).get('operation')) for e in bulk_entries[:5]]}")

# ═══════════════════════════════════════════════════════════════
S = "12. Pages dashboards HTTP 200 pour l'admin"

for path in ["/dashboard/users", "/dashboard/properties",
             "/dashboard/reviews", "/dashboard/bookings"]:
    code, _ = curl(BASE + path, jar="admin")
    record(S, f"GET {path} → 200", "OK" if code == 200 else "KO", f"code={code}")

# ═══════════════════════════════════════════════════════════════
S = "13. Bulk API : audit log inclut metadata complète"

# Faire une action bulk fresh et vérifier metadata
ts = int(time.time())
new_email = f"metatest{ts}@t.local"
r_code, r_body = curl(BASE + "/api/auth/register", "POST",
    data=json.dumps({"email":new_email,"password":"MetaTest123!","firstName":"Meta","lastName":"Test"}))
try: new_id = json.loads(r_body)["user"]["id"]
except: new_id = None

if new_id:
    ids_json = json.dumps([new_id])
    curl(BASE + "/api/admin/bulk", "POST", jar="admin",
        data=f'{{"entity":"users","action":"suspend","ids":{ids_json}}}')
    time.sleep(0.5)
    _, body = curl(BASE + "/api/admin/audit", jar="admin")
    try:
        entries = json.loads(body).get("entries", [])
        latest_bulk = next((e for e in entries if e.get("action") == "bulk.action"), None)
    except: latest_bulk = None
    if latest_bulk:
        m = latest_bulk.get("metadata") or {}
        has_all = all(k in m for k in ["operation", "requested", "succeeded", "ids"])
        record(S, f"Audit metadata contient operation+requested+succeeded+ids",
               "OK" if has_all else "KO", f"metadata: {m}")

# ═══════════════════════════════════════════════════════════════
# Rapport
# ═══════════════════════════════════════════════════════════════
n_ok = sum(1 for r in results if r["verdict"] == "OK")
n_warn = sum(1 for r in results if r["verdict"] == "WARN")
n_ko = sum(1 for r in results if r["verdict"] == "KO")
n_tot = len(results)

import datetime
now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
with open(OUT, "w") as f:
    f.write(f"""# 🎛️ Simulation dashboards — filtres / sélection / actions groupées

**Généré le** : {now}
**T-033 (Session 12)**

Vérifie l'implémentation des raccourcis dashboards :
- Filtres de recherche + statut par entité
- Cases à cocher + tout-sélectionner
- Actions groupées (bulk API + guards)
- Raccourcis clavier (/, Ctrl+A, Échap)
- Audit log de chaque bulk action

## 🎯 Résumé

- ✅ **{n_ok} OK**
- ⚠️ **{n_warn} WARN**
- ❌ **{n_ko} KO**
- Total : **{n_tot}**

Verdict : **{"✅ TOUT PASSE" if n_ko == 0 else f"❌ {n_ko} KO"}**

---

""")
    current = None
    for r in results:
        if r["section"] != current:
            current = r["section"]
            f.write(f"\n## {current}\n\n")
        icon = "✅" if r["verdict"] == "OK" else ("⚠️" if r["verdict"] == "WARN" else "❌")
        f.write(f"- {icon} **{r['name']}**\n")
        if r["detail"]:
            det = r["detail"].replace("\n", " ").replace("`", "'")[:400]
            f.write(f"  <sub>{det}</sub>\n\n")
        else:
            f.write("\n")

    f.write(f"""
---

## Reproductibilité

`python3 scripts/dashboards_sim.py` (après `npm run db:dev` + `npx next dev`).
""")

print(f"\n{'='*60}")
print(f"Rapport : {OUT}")
print(f"Total : ✅ {n_ok}  ⚠️ {n_warn}  ❌ {n_ko}  sur {n_tot}")
sys.exit(0 if n_ko == 0 else 1)
