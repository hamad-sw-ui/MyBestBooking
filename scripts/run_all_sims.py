#!/usr/bin/env python3
"""Runner unifié qui garantit 0 KO sur TOUTES les simulations.

Entre chaque simulation :
- Cleanup DB (bookings tests, 2FA seed, wallet reset)
- Restart Next.js (vide les rate-limits mémoire)
- Wait /api/health = 200

Séquence : smoke → surface → deep → xtreme → paranoid
Exit code : 0 si tout passe, 1 sinon.
"""
import subprocess, time, sys, os, re, glob

BASE = "http://127.0.0.1:3000"
REPO = "/home/user/MyBestBooking"
LOGDIR = "/tmp/sim-runs"
os.makedirs(LOGDIR, exist_ok=True)

def log(msg): print(f"\n\033[1;36m═══ {msg} ═══\033[0m", flush=True)
def ok(msg):  print(f"  \033[32m✅ {msg}\033[0m", flush=True)
def ko(msg):  print(f"  \033[31m❌ {msg}\033[0m", flush=True)

def _run(args, timeout=15):
    """subprocess.run tolérant : TimeoutExpired → stdout vide (pas de crash).

    T-155 (audit n°27) : après un run, PostgreSQL peut être momentanément
    occupé (pool de connexions Next en fermeture) — on retry au lieu de
    faire planter le runner.
    """
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return type("R", (), {"stdout": "", "stderr": "", "returncode": -1})()

def db_query(sql, tries=3):
    for attempt in range(tries):
        r = _run(["node","-e", f"""
const {{Client}} = require('pg');
const c = new Client({{connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/app_db'}});
c.connect().then(async () => {{
  try {{ await c.query(`{sql}`); console.log('ok'); }}
  catch (e) {{ console.log('err:'+e.message); }}
  await c.end();
}});"""], timeout=20)
        out = r.stdout.strip()
        if out == "ok":
            return "ok"
        if attempt < tries - 1:
            time.sleep(2)
    return ""

def cleanup_db():
    """Reset DB state pour rendre chaque simulation reproductible."""
    # 2FA off sur seed
    db_query("UPDATE users SET two_factor_enabled=false, two_factor_secret=null WHERE email LIKE '%@mybestbooking.com'")
    # Wallet + BR level customer
    db_query("UPDATE users SET wallet_balance='25.00', bestrewards_bookings_count=7, bestrewards_level=2 WHERE email='customer@mybestbooking.com'")
    # Effacer les bookings de test des runs précédents
    db_query("DELETE FROM bookings WHERE guest_first_name IN ('Racer','ParaFix','RaceFix','Trans','Calc','Wallet','Anonymous','Blocked','Deep','Sim','BlockTest','FreeTest','Combo','Simulation','Delete','Verify','Reset','Gdpr','Suspend','Cookie','Emoji','Long','Xss') OR guest_first_name LIKE 'Race%' OR guest_first_name LIKE 'Trans%' OR guest_first_name LIKE 'Chevauchement%' OR guest_first_name LIKE 'Rate%' OR guest_first_name LIKE 'Wallet%'")
    # Effacer les users test créés (email @t.local ou @test.local, sauf seed)
    db_query("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@t.local' OR email LIKE '%@test.local' OR email LIKE '%@anonymized.local')")
    # T-160/T-166 (audit n°30) : les runs laissent aussi des votes d'avis,
    # des listes de favoris et des alertes prix — sinon ils s'accumulent
    # (123 wishlists mesurées, 1er vote « utile » → 409 « déjà voté »).
    db_query("DELETE FROM review_votes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@t.local' OR email LIKE '%@test.local' OR email LIKE '%@anonymized.local')")
    db_query("DELETE FROM review_votes WHERE review_id IN (SELECT id FROM reviews WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@t.local' OR email LIKE '%@test.local' OR email LIKE '%@anonymized.local'))")
    db_query("DELETE FROM price_alerts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@t.local' OR email LIKE '%@test.local' OR email LIKE '%@anonymized.local')")
    db_query("DELETE FROM wishlist_items WHERE wishlist_id IN (SELECT id FROM wishlists WHERE name ~ '^rate-test-[0-9]+' OR name IN ('Public share test','Voyage été 2027') OR (name='Mes favoris' AND id NOT IN (SELECT DISTINCT wishlist_id FROM wishlist_items)))")
    db_query("DELETE FROM wishlists WHERE name ~ '^rate-test-[0-9]+' OR name IN ('Public share test','Voyage été 2027') OR (name='Mes favoris' AND id NOT IN (SELECT DISTINCT wishlist_id FROM wishlist_items))")
    # Attention aux FK bookings → on ne supprime pas les users, on les laisse comme historique
    ok("cleanup DB")

def restart_next():
    """Restart Next.js pour vider les rate-limits mémoire."""
    # Ping health
    def health():
        r = _run(["curl","-s","-o","/dev/null","-w","%{http_code}","--max-time","3",
                  BASE + "/api/health"], timeout=6)
        return r.stdout.strip() == "200"

    # Kill existant
    subprocess.run(["pkill","-f","next dev"], capture_output=True, timeout=5)
    subprocess.run(["pkill","-f","next-server"], capture_output=True, timeout=5)
    time.sleep(2)

    # Démarrer
    log_f = open(f"{LOGDIR}/next.log", "w")
    subprocess.Popen(
        ["npx","next","dev","-H","0.0.0.0","-p","3000"],
        cwd=REPO, stdout=log_f, stderr=log_f,
        start_new_session=True,
    )

    # Attendre health OK
    for i in range(30):
        if health():
            ok(f"Next up (port 3000) après {i+1}s")
            return True
        time.sleep(1)
    ko("Next ne démarre pas")
    return False

def run_sim(name, cmd):
    """Lance une simulation, retourne (passed, ok_count, warn_count, ko_count)."""
    log(f"Simulation : {name}")
    cleanup_db()
    if not restart_next():
        return (False, 0, 0, 1)
    log_path = f"{LOGDIR}/{name}.log"
    with open(log_path, "w") as f:
        p = subprocess.run(cmd, shell=True, cwd=REPO, stdout=f, stderr=subprocess.STDOUT, timeout=300)
    with open(log_path) as f:
        content = f.read()

    # Format smoke.sh
    if "smoke OK" in content:
        m = re.search(r"smoke OK \((\d+) assertions\)", content)
        n = int(m.group(1)) if m else 0
        ok(f"{name} : smoke OK ({n} assertions)")
        return (True, n, 0, 0)
    elif "smoke KO" in content:
        m = re.search(r"FAIL\s*:\s*(\d+)", content)
        ko_n = int(m.group(1)) if m else 1
        ko(f"{name} : smoke KO ({ko_n} FAILs)")
        # Afficher les fails
        for line in content.split("\n"):
            if line.strip().startswith("- ") and "attendu" in line:
                print(f"    {line.strip()}")
        return (False, 0, 0, ko_n)

    # Format simulate.py : "Total : X PASS · Y KO"
    m = re.search(r"Total\s*:\s*(\d+)\s*PASS\s*·\s*(\d+)\s*KO", content)
    if m:
        n_ok = int(m.group(1)); n_ko = int(m.group(2))
        if n_ko == 0:
            ok(f"{name} : {n_ok} PASS · 0 KO")
            return (True, n_ok, 0, 0)
        else:
            ko(f"{name} : {n_ok} PASS · {n_ko} KO")
            for line in content.split("\n"):
                if "❌" in line and "KO" not in line:
                    print(f"    {line.strip()[:200]}")
            return (False, n_ok, 0, n_ko)

    # Format deep/xtreme/paranoid : "Total : ✅ X  ⚠️ Y  ❌ Z  sur T"
    m = re.search(r"Total\s*:\s*✅\s*(\d+)\s*⚠️?\s*(\d+)\s*❌\s*(\d+)", content)
    if m:
        n_ok = int(m.group(1)); n_warn = int(m.group(2)); n_ko = int(m.group(3))
        if n_ko == 0:
            ok(f"{name} : {n_ok} OK · {n_warn} WARN · 0 KO")
            return (True, n_ok, n_warn, 0)
        else:
            ko(f"{name} : {n_ok} OK · {n_warn} WARN · {n_ko} KO")
            for line in content.split("\n"):
                if line.startswith("❌"):
                    print(f"    {line[:200]}")
            return (False, n_ok, n_warn, n_ko)

    ko(f"{name} : format de sortie non reconnu")
    print(f"    tail: {content[-300:]}")
    return (False, 0, 0, 1)

# ─── Séquence ─────────────────────────────────────────────────
sims = [
    ("smoke",    "SMOKE_KEEP_ALIVE=1 SMOKE_BASE_URL=http://127.0.0.1:3000 bash scripts/smoke.sh"),
    ("surface",  "python3 scripts/simulate.py"),
    ("deep",     "python3 scripts/deep_sim.py"),
    ("xtreme",   "python3 scripts/xtreme_sim.py"),
    ("paranoid", "python3 scripts/paranoid_sim.py"),
]

results = []
for name, cmd in sims:
    passed, n_ok, n_warn, n_ko = run_sim(name, cmd)
    results.append((name, passed, n_ok, n_warn, n_ko))

# ─── Bilan ─────────────────────────────────────────────────────
log("BILAN FINAL")
total_ok = sum(r[2] for r in results)
total_warn = sum(r[3] for r in results)
total_ko = sum(r[4] for r in results)
all_pass = all(r[1] for r in results)

print(f"\n  {'Simulation':<12} {'OK':>6} {'WARN':>6} {'KO':>6}  Status")
print(f"  {'-'*12} {'-'*6} {'-'*6} {'-'*6}  {'-'*10}")
for name, passed, n_ok, n_warn, n_ko in results:
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  {name:<12} {n_ok:>6} {n_warn:>6} {n_ko:>6}  {status}")
print(f"  {'-'*12} {'-'*6} {'-'*6} {'-'*6}  {'-'*10}")
print(f"  {'TOTAL':<12} {total_ok:>6} {total_warn:>6} {total_ko:>6}")

if all_pass:
    print(f"\n\033[1;32m✅ TOUTES les simulations passent · 0 KO ({total_ok} assertions cumulées)\033[0m")
    sys.exit(0)
else:
    print(f"\n\033[1;31m❌ {sum(1 for r in results if not r[1])}/{len(results)} simulations en échec\033[0m")
    sys.exit(1)
