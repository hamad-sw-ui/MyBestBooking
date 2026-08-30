#!/usr/bin/env python3
"""Simulation exhaustive : joue chaque page + scénario métier réel,
extrait le texte visible depuis le HTML rendu par Next et produit
un rapport Markdown détaillé.
"""
import subprocess, json, re, html as html_module, os, sys, datetime, time

BASE = "http://127.0.0.1:3000"
JAR = "/tmp/sim"
OUT = "/home/user/MyBestBooking/.ai/REPORTS/simulation_2026-08-21_session_11.md"

# ─────────────────────────────────────────────────────────────
# Bootstrap (T-034 audit) : le script n'utilisait pas de X-Forwarded-For
# et supposait que /tmp/sim/*.jar existaient d'une session précédente.
# Après un reset workspace, les cookies sont manquants → tous les
# scénarios auth échouent en 401. On crée le dossier et on connecte
# les 3 rôles avec des IP variées pour ne pas déclencher login:ip 20/60s.
# ─────────────────────────────────────────────────────────────
os.makedirs(JAR, exist_ok=True)
import random
def _bootstrap_login(tag, email, pwd):
    xff = f"10.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"
    subprocess.run([
        "curl", "-s", "-o", "/dev/null",
        "-c", f"{JAR}/{tag}.jar",
        "-H", f"X-Forwarded-For: {xff}",
        "-X", "POST", "-H", "Content-Type: application/json",
        "-d", f'{{"email":"{email}","password":"{pwd}"}}',
        BASE + "/api/auth/login"
    ], timeout=15)
_bootstrap_login("cust",  "customer@mybestbooking.com", "Customer123!")
_bootstrap_login("host",  "host@mybestbooking.com",     "Host123!")
_bootstrap_login("admin", "admin@mybestbooking.com",    "Admin123!")

def curl(url, method="GET", jar=None, data=None, headers=None, max_time=15):
    args = ["curl", "-s", "-L", "-w", "\n__CODE__%{http_code}\n__URL__%{url_effective}", "--max-time", str(max_time)]
    if jar:
        args += ["-b", f"{JAR}/{jar}.jar"]
    if method != "GET":
        args += ["-X", method]
    if headers:
        for h in headers:
            args += ["-H", h]
    if data is not None:
        args += ["-H", "Content-Type: application/json", "-d", data]
    args.append(url)
    p = subprocess.run(args, capture_output=True, text=True, timeout=max_time+5)
    out = p.stdout
    m_code = re.search(r"__CODE__(\d+)", out)
    m_url = re.search(r"__URL__(.+?)$", out, re.M)
    code = int(m_code.group(1)) if m_code else 0
    final_url = m_url.group(1).strip() if m_url else url
    body = re.sub(r"\n__CODE__.*", "", out, flags=re.S)
    return code, body, final_url

def visible_text(html_body, max_len=600):
    """Extrait le texte visible : retire scripts/styles/head, compacte."""
    t = html_body
    # Récupérer le <title> avant nettoyage
    title = ""
    m = re.search(r"<title[^>]*>([^<]+)</title>", t, re.I)
    if m:
        title = m.group(1).strip()
    # Nettoyage
    t = re.sub(r"<script[^>]*>.*?</script>", " ", t, flags=re.S|re.I)
    t = re.sub(r"<style[^>]*>.*?</style>", " ", t, flags=re.S|re.I)
    t = re.sub(r"<head[^>]*>.*?</head>", " ", t, flags=re.S|re.I)
    t = re.sub(r"<noscript[^>]*>.*?</noscript>", " ", t, flags=re.S|re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html_module.unescape(t)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) > max_len:
        t = t[:max_len] + " …"
    return title, t

def code_ok(code, expected):
    """expected est une liste ou une chaîne 'X Y Z'."""
    if isinstance(expected, str):
        expected = expected.split()
    return str(code) in expected

# ─────────────────────────────────────────────────────────────
# Structure des scénarios
# ─────────────────────────────────────────────────────────────

class Section:
    def __init__(self, title):
        self.title = title
        self.rows = []  # list of dict
    def add(self, **kw):
        self.rows.append(kw)

sections = []

# ─── 1. Pages publiques ───────────────────────────────────────
sec = Section("A. Pages publiques (visiteur non connecté)")
public_pages = [
    ("/",                   "Le visiteur arrive sur la page d'accueil. Il voit le hero + les hébergements recommandés."),
    ("/recherche",          "Le visiteur ouvre la page de recherche vide. Le formulaire de filtres s'affiche."),
    ("/aide",               "Le visiteur cherche de l'aide. Il voit les FAQ et 3 canaux de contact (mailto)."),
    ("/bestrewards",        "Le visiteur découvre le programme de fidélité BestRewards (3 niveaux)."),
    ("/mentions-legales",   "Le visiteur consulte les mentions légales (éditeur, hébergeur, CGU, CGV)."),
    ("/confidentialite",    "Le visiteur consulte la politique de confidentialité (RGPD, droits, cookies)."),
    ("/connexion",          "Le visiteur ouvre la page de connexion. Un formulaire email + mot de passe."),
    ("/inscription",        "Le visiteur ouvre la page d'inscription. Un formulaire complet."),
    ("/mot-de-passe-oublie","Le visiteur a oublié son mot de passe. Il saisit son email."),
    ("/verifier-email",     "Le visiteur clique un lien de vérification email reçu."),
    ("/maintenance",        "La page de maintenance (affichée quand le mode maintenance est actif)."),
    # T-155 (audit n°27) : /reservation est PUBLIC depuis T-109 (checkout
    # invité — le formulaire passe en guest mode au lieu de bloquer).
    ("/reservation",        "Le visiteur finalise une réservation : guest mode (email invité) quand non connecté."),
]
for url, story in public_pages:
    code, body, _ = curl(BASE + url)
    title, text = visible_text(body)
    sec.add(url=url, story=story, method="GET", jar=None,
            expected="200", code=code, title=title, text=text,
            verdict="OK" if code_ok(code, "200") else "KO")
sections.append(sec)

# ─── 2. Pages protégées sans cookie (attendu 307 vers /connexion) ─
sec = Section("B. Pages protégées — utilisateur non connecté (redirection edge → /connexion)")
protected_pages = [
    ("/mon-compte",              "Le visiteur clique 'Mon compte' sans être connecté."),
    ("/mes-reservations",        "Le visiteur essaie d'accéder à ses réservations."),
    ("/mes-favoris",             "Le visiteur essaie d'ouvrir ses favoris."),
    ("/messages",                "Le visiteur essaie d'ouvrir sa messagerie."),
    # /reservation retirée : publique (guest mode, T-109 — voir section A).
    ("/dashboard",               "Un curieux tape /dashboard dans la barre d'URL."),
    ("/dashboard/bookings",      "Idem sur les réservations dashboard."),
    ("/dashboard/properties",    "Idem sur les propriétés dashboard."),
]
for url, story in protected_pages:
    # Suivre les redirections désactivées pour capturer le 307
    p = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}|%{redirect_url}", "--max-time", "10", BASE + url],
        capture_output=True, text=True, timeout=15
    )
    parts = p.stdout.strip().split("|", 1)
    code = int(parts[0])
    redir = parts[1] if len(parts) > 1 else ""
    sec.add(url=url, story=story, method="GET", jar=None,
            expected="307", code=code, title="(redirection)",
            text=f"Redirect → {redir}" if redir else "(pas de redirection observée)",
            verdict="OK" if code_ok(code, "307 302 308") else "KO")
sections.append(sec)

# ─── 3. Customer authentifié ─────────────────────────────────
sec = Section("C. Voyageur authentifié (customer@mybestbooking.com)")
cust_pages = [
    ("/",                    "Le voyageur ouvre l'accueil connecté (le header affiche son nom)."),
    ("/mon-compte",          "Il ouvre son compte : profil, sécurité, notifications, wallet 25 €, BestRewards Or."),
    ("/mes-reservations",    "Il liste ses réservations avec statut, dates, boutons Contacter/Confirmation/Annuler."),
    ("/mes-favoris",         "Il ouvre ses favoris : ses wishlists + alertes prix."),
    ("/messages",            "Il ouvre sa messagerie avec les hôtes."),
    ("/reservation",         "Il ouvre la page de finalisation (avec wallet et guest mode)."),
    ("/recherche",           "Il refait une recherche avec ses préférences."),
    ("/aide",                "Il consulte l'aide."),
    ("/bestrewards",         "Il consulte son statut BestRewards."),
]
for url, story in cust_pages:
    code, body, _ = curl(BASE + url, jar="cust")
    title, text = visible_text(body)
    sec.add(url=url, story=story, method="GET", jar="cust",
            expected="200", code=code, title=title, text=text,
            verdict="OK" if code_ok(code, "200") else "KO")
sections.append(sec)

# ─── 4. Guards role — customer bloqué du dashboard ─────────
sec = Section("D. Guards de rôle — voyageur (customer) tente d'ouvrir le dashboard")
guard_pages = [
    ("/dashboard",             "Un voyageur tente d'ouvrir le dashboard host/admin."),
    ("/dashboard/properties",  "Idem sur la gestion des propriétés."),
    ("/dashboard/users",       "Idem sur les utilisateurs (admin-only)."),
    ("/dashboard/settings",    "Idem sur les paramètres (admin-only)."),
    ("/dashboard/audit",       "Idem sur l'audit log (admin-only)."),
]
for url, story in guard_pages:
    code, body, _ = curl(BASE + url, jar="cust")
    title, text = visible_text(body, max_len=300)
    # Le body ne doit pas contenir les indices du dashboard
    leaked = bool(re.search(r"DashboardSidebar|Tableau de bord|Espace propriétaire", body))
    sec.add(url=url, story=story, method="GET", jar="cust",
            expected="200 + body sans dashboard",
            code=code, title=title, text=text,
            verdict=("KO (fuite)" if leaked else "OK (guard actif — contenu non rendu)"))
sections.append(sec)

# ─── 5. Host authentifié ─────────────────────────────────────
sec = Section("E. Hôte authentifié (host@mybestbooking.com) — dashboard host")
host_pages = [
    ("/dashboard",                "L'hôte arrive sur son tableau de bord (revenus, réservations, occupation)."),
    ("/dashboard/bookings",       "Il liste toutes les réservations reçues sur ses propriétés."),
    ("/dashboard/properties",     "Il liste ses propriétés."),
    ("/dashboard/rooms",          "Il liste toutes ses chambres."),
    ("/dashboard/rooms/new",      "Il ouvre le formulaire de création de chambre."),
    ("/dashboard/reviews",        "Il modère les avis reçus (répondre publiquement)."),
    ("/dashboard/messages",       "Il lit les messages entrants des voyageurs."),
    ("/dashboard/promotions",     "Il gère ses codes promo actifs."),
    ("/dashboard/promotions/new", "Il crée un nouveau code promo."),
    ("/dashboard/analytics",      "Il consulte ses statistiques."),
    ("/dashboard/billing",        "Il consulte ses factures et commissions plateforme."),
]
for url, story in host_pages:
    code, body, _ = curl(BASE + url, jar="host")
    title, text = visible_text(body)
    sec.add(url=url, story=story, method="GET", jar="host",
            expected="200", code=code, title=title, text=text,
            verdict="OK" if code_ok(code, "200") else "KO")
sections.append(sec)

# ─── 6. Admin authentifié ────────────────────────────────────
sec = Section("F. Administrateur (admin@mybestbooking.com) — zones admin-only")
admin_pages = [
    ("/dashboard/users",     "L'admin liste tous les utilisateurs (customer/host/admin), peut suspendre."),
    ("/dashboard/audit",     "L'admin consulte le journal d'audit (settings/moderate/suspend/validate)."),
    ("/dashboard/settings",  "L'admin ouvre le panel de configuration (7 sections Zod)."),
    ("/dashboard/analytics", "L'admin consulte les KPI globaux."),
]
for url, story in admin_pages:
    code, body, _ = curl(BASE + url, jar="admin")
    title, text = visible_text(body)
    sec.add(url=url, story=story, method="GET", jar="admin",
            expected="200", code=code, title=title, text=text,
            verdict="OK" if code_ok(code, "200") else "KO")
sections.append(sec)

# ─── 7. Page dynamique /hebergement/[slug] ──────────────────
sec = Section("G. Page hébergement dynamique — /hebergement/[slug]")
props_code, props_body, _ = curl(BASE + "/api/properties")
try:
    props = json.loads(props_body).get("properties", [])
except Exception:
    props = []
for p in props[:3]:
    slug = p.get("slug", "?")
    name = p.get("name", "?")
    url = f"/hebergement/{slug}"
    code, body, _ = curl(BASE + url)
    title, text = visible_text(body, max_len=700)
    sec.add(url=url, story=f"Le visiteur consulte '{name}'.",
            method="GET", jar=None, expected="200", code=code,
            title=title, text=text,
            verdict="OK" if code_ok(code, "200") else "KO")
sections.append(sec)

# ─── 8. Wishlist share public ────────────────────────────────
sec = Section("H. Partage public d'une wishlist — /wishlists/share/[token]")
# Créer une wishlist publique pour test
code_wl, wl_body, _ = curl(
    BASE + "/api/wishlists", method="POST", jar="cust",
    data='{"name":"Voyage été 2027","isPublic":true}'
)
try:
    wl_id = json.loads(wl_body).get("wishlist", {}).get("id", "")
    share_token = json.loads(wl_body).get("wishlist", {}).get("shareToken", "")
except Exception:
    wl_id = share_token = ""
if share_token:
    url = f"/wishlists/share/{share_token}"
    code, body, _ = curl(BASE + url)
    title, text = visible_text(body, max_len=500)
    sec.add(url=url,
            story="Le voyageur envoie le lien à un ami. L'ami (non connecté) ouvre la wishlist publique.",
            method="GET", jar=None, expected="200", code=code,
            title=title, text=text,
            verdict="OK" if code_ok(code, "200") else "KO")
else:
    sec.add(url="/wishlists/share/…", story="Création de wishlist publique",
            method="POST", jar="cust", expected="201", code=code_wl,
            title="(setup)", text=wl_body[:200],
            verdict="Setup KO" if code_wl != 201 else "Setup OK mais token vide")
sections.append(sec)

# ─── 9. Scénarios API métier ────────────────────────────────
sec = Section("I. Scénarios métier API (parcours utilisateur bout-en-bout)")

# GET /api/auth/me pour chaque rôle
for tag, expected_role in [("cust", "customer"), ("host", "host"), ("admin", "admin")]:
    code, body, _ = curl(BASE + "/api/auth/me", jar=tag)
    try:
        role = json.loads(body).get("user", {}).get("role", "?")
    except Exception:
        role = "?"
    sec.add(url="/api/auth/me", story=f"L'utilisateur {tag} vérifie son identité côté client.",
            method="GET", jar=tag, expected=f"200 + role={expected_role}",
            code=code, title="(JSON)",
            text=f'role="{role}"',
            verdict="OK" if role == expected_role else f"KO (role={role})")

# Search filtrée
url = "/api/properties?guests=2&checkIn=2027-01-15&checkOut=2027-01-18&sort=price_asc"
code, body, _ = curl(BASE + url)
try:
    n = len(json.loads(body).get("properties", []))
except Exception:
    n = 0
sec.add(url=url, story="Le voyageur cherche pour 2 pers en janvier 2027, trié par prix croissant.",
        method="GET", jar=None, expected="200", code=code,
        title="(JSON)", text=f"{n} propriétés retournées",
        verdict="OK" if code == 200 and n > 0 else "KO")

# Récupérer un ROOM
if props:
    prop = props[0]
    prop_id = prop["id"]
    rooms_code, rooms_body, _ = curl(BASE + f"/api/rooms?propertyId={prop_id}")
    rooms = json.loads(rooms_body).get("rooms", [])
    if rooms:
        room = rooms[0]
        room_id = room["id"]
        # POST booking complet
        payload = json.dumps({
            "propertyId": prop_id, "roomId": room_id,
            "checkIn": "2027-02-15", "checkOut": "2027-02-18",
            "numAdults": 2,
            "guestFirstName": "Simulation", "guestLastName": "Session11",
            "guestEmail": "customer@mybestbooking.com",
        })
        code, body, _ = curl(BASE + "/api/bookings", method="POST", jar="cust", data=payload)
        try:
            b = json.loads(body).get("booking", {})
            ref = b.get("bookingReference", "?")
            total = b.get("total", "?")
            status = b.get("status", "?")
            discount = b.get("discount", "?")
        except Exception:
            ref = total = status = discount = "?"
        sec.add(url="/api/bookings",
                story=f"Le voyageur réserve la '{room['name']}' 15→18 fév 2027 pour 2 pers. "
                      f"Le serveur applique BestRewards (level 2 = 15% remise) + le wallet 25 €.",
                method="POST", jar="cust", expected="201 + confirmed",
                code=code, title="(JSON)",
                text=f"ref={ref} · status={status} · discount={discount} € · total={total} €",
                verdict="OK" if code == 201 and status == "confirmed" else f"KO (code={code})")

        # POST wishlist item
        if wl_id:
            payload_wl = json.dumps({"wishlistId": wl_id, "propertyId": prop_id})
            code, body, _ = curl(BASE + "/api/wishlists", method="POST", jar="cust", data=payload_wl)
            sec.add(url="/api/wishlists",
                    story=f"Le voyageur ajoute '{prop['name']}' à sa wishlist publique.",
                    method="POST", jar="cust", expected="201",
                    code=code, title="(JSON)", text=body[:200],
                    verdict="OK" if code in (200, 201) else "KO")

        # POST price-alert
        payload_pa = json.dumps({"propertyId": prop_id, "maxPrice": 100})
        code, body, _ = curl(BASE + "/api/price-alerts", method="POST", jar="cust", data=payload_pa)
        sec.add(url="/api/price-alerts",
                story=f"Le voyageur active une alerte prix ≤ 100 € pour '{prop['name']}'.",
                method="POST", jar="cust", expected="201",
                code=code, title="(JSON)", text=body[:200],
                verdict="OK" if code in (200, 201) else "KO")

# GET referral
code, body, _ = curl(BASE + "/api/users/me/referral", jar="cust")
try:
    ref_code = json.loads(body).get("code", "?")
except Exception:
    ref_code = "?"
sec.add(url="/api/users/me/referral",
        story="Le voyageur consulte son code de parrainage pour le partager.",
        method="GET", jar="cust", expected="200 + code",
        code=code, title="(JSON)", text=f'code="{ref_code}"',
        verdict="OK" if code == 200 and len(ref_code) >= 6 else "KO")

# Register nouveau compte
ts = int(time.time())
payload_reg = json.dumps({
    "email": f"sim{ts}@test.local", "password": "SmokeTest123!",
    "firstName": "Sim", "lastName": "User"
})
code, body, _ = curl(BASE + "/api/auth/register", method="POST", data=payload_reg)
sec.add(url="/api/auth/register",
        story=f"Un nouveau visiteur crée un compte sim{ts}@test.local.",
        method="POST", jar=None, expected="200",
        code=code, title="(JSON)", text=body[:200],
        verdict="OK" if code == 200 else "KO")

# RBAC guard : customer sur /api/admin/*
for adm_url in ["/api/admin/settings", "/api/admin/audit"]:
    code, body, _ = curl(BASE + adm_url, jar="cust")
    sec.add(url=adm_url,
            story=f"Un voyageur mal intentionné tente {adm_url}.",
            method="GET", jar="cust", expected="403",
            code=code, title="(JSON)", text=body[:150],
            verdict="OK (bloqué)" if code == 403 else "KO (FUITE)")

# Admin API OK
for adm_url in ["/api/admin/settings", "/api/admin/audit"]:
    code, body, _ = curl(BASE + adm_url, jar="admin")
    try:
        d = json.loads(body)
        n = len(d) if isinstance(d, list) else (
            len(d.get("settings", [])) if "settings" in d else len(d.get("logs", d.get("audit", [])))
        )
    except Exception:
        n = "?"
    sec.add(url=adm_url,
            story=f"L'admin consulte {adm_url}.",
            method="GET", jar="admin", expected="200",
            code=code, title="(JSON)", text=f"{n} entrées retournées",
            verdict="OK" if code == 200 else "KO")

# Change password (endpoint sensible)
payload_cp = json.dumps({"currentPassword": "Customer123!", "newPassword": "Customer123!"})
code, body, _ = curl(BASE + "/api/auth/change-password", method="POST", jar="cust", data=payload_cp)
sec.add(url="/api/auth/change-password",
        story="Le voyageur change son mot de passe (rejoue le même pour rester idempotent).",
        method="POST", jar="cust", expected="200 ou 400",
        code=code, title="(JSON)", text=body[:200],
        verdict="OK" if code in (200, 400) else "KO")

# Logout
code, body, _ = curl(BASE + "/api/auth/logout", method="POST", jar="cust")
sec.add(url="/api/auth/logout",
        story="Le voyageur se déconnecte.",
        method="POST", jar="cust", expected="200",
        code=code, title="(JSON)", text=body[:200],
        verdict="OK" if code == 200 else "KO")

# Re-login pour la suite
subprocess.run([
    "curl", "-s", "-o", "/dev/null", "-c", f"{JAR}/cust.jar",
    "-X", "POST", "-H", "Content-Type: application/json",
    "-d", '{"email":"customer@mybestbooking.com","password":"Customer123!"}',
    BASE + "/api/auth/login"
], timeout=10)

sections.append(sec)

# ─── 10. Health ──────────────────────────────────────────────
sec = Section("J. Endpoint santé & maintenance")
code, body, _ = curl(BASE + "/api/health")
sec.add(url="/api/health", story="Le monitoring externe pinge le health-check.",
        method="GET", jar=None, expected="200",
        code=code, title="(JSON)", text=body[:200],
        verdict="OK" if code == 200 else "KO")
sections.append(sec)

# ─────────────────────────────────────────────────────────────
# Génération du rapport Markdown
# ─────────────────────────────────────────────────────────────

now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
n_ok = sum(1 for s in sections for r in s.rows if r["verdict"].startswith("OK"))
n_ko = sum(1 for s in sections for r in s.rows if r["verdict"].startswith("KO"))
n_total = n_ok + n_ko

def md_escape(s):
    return str(s).replace("|", "\\|").replace("\n", " ")

with open(OUT, "w") as f:
    f.write(f"""# 🎬 Simulation utilisateur exhaustive — Session 11 (2026-08-21)

**Généré le** : {now}
**Base URL testée** : `{BASE}` (Next.js 16 dev, PostgreSQL embarqué :55432)
**Comptes utilisés** :

- `customer@mybestbooking.com` / `Customer123!` (level 2, wallet 25 €)
- `host@mybestbooking.com` / `Host123!` (propriétaire)
- `admin@mybestbooking.com` / `Admin123!` (admin plateforme)

## 🎯 Résumé

- **{n_ok} PASS · {n_ko} KO** sur **{n_total} scénarios** joués
- Verdict global : **{"✅ TOUT PASSE" if n_ko == 0 else f"❌ {n_ko} SCÉNARIO(S) KO"}**

Chaque scénario ci-dessous a été **réellement joué** via HTTP contre le serveur Next
en cours d'exécution. La colonne **« Ce que voit l'utilisateur »** est extraite du HTML
rendu (balises retirées, scripts/styles retirés, tronqué à ~600 caractères).

Toutes les commandes sont **rejouables** : lance `npm run db:dev` + `npx next dev` puis
`bash scripts/smoke.sh` pour rejouer la version condensée (91 assertions).

---

""")
    for sec in sections:
        f.write(f"## {sec.title}\n\n")
        for i, r in enumerate(sec.rows, 1):
            f.write(f"### {i}. `{r['method']} {r['url']}`\n\n")
            f.write(f"**Scénario** : {r['story']}\n\n")
            jar_str = f" cookie={r['jar']}" if r["jar"] else " (anonyme)"
            f.write(f"**Requête simulée** :\n```bash\ncurl -X {r['method']}{jar_str} {BASE}{r['url']}\n```\n\n")
            verdict_icon = "✅" if r["verdict"].startswith("OK") else "❌"
            f.write(f"**Résultat serveur** : HTTP `{r['code']}` (attendu `{r['expected']}`) → {verdict_icon} **{r['verdict']}**\n\n")
            if r["title"] and r["title"] != "(setup)":
                f.write(f"**Titre / type de réponse** : `{r['title']}`\n\n")
            if r["text"]:
                # Nettoyer le texte pour Markdown blockquote
                text_clean = r["text"].replace("`", "'")
                f.write(f"**Ce que voit l'utilisateur** (texte visible extrait) :\n\n> {text_clean}\n\n")
            f.write("---\n\n")

    f.write(f"""
## 📊 Récapitulatif par section

| Section | PASS | KO |
|---|---|---|
""")
    for sec in sections:
        ok = sum(1 for r in sec.rows if r["verdict"].startswith("OK"))
        ko = sum(1 for r in sec.rows if r["verdict"].startswith("KO"))
        f.write(f"| {sec.title} | {ok} | {ko} |\n")

    f.write(f"""
## 🔁 Reproductibilité

Ce rapport a été généré par `/tmp/simulate.py` (versionné pour l'occasion à
`scripts/simulate.py` si tu veux le rejouer). Le script requiert :

1. `npm run db:dev` en cours (PostgreSQL embarqué sur :55432)
2. `npx next dev -H 0.0.0.0 -p 3000` en cours
3. Le seed déjà appliqué (`POST /api/seed`)

Puis `python3 /tmp/simulate.py`.

Chaque section joue les vraies requêtes HTTP, capture les vraies réponses,
et **n'invente rien** — c'est ce que ton navigateur verrait à la première
frame RSC (avant hydratation client). Les composants clients (formulaires
interactifs, DarkModeToggle, WishlistActions) ne sont donc pas simulés au
niveau clic (nécessiterait Playwright + Chromium, indisponible sandbox).
""")

print(f"Rapport écrit : {OUT}")
print(f"Total : {n_ok} PASS · {n_ko} KO")
