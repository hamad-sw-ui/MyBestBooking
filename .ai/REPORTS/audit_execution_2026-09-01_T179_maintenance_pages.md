# 🔍 Audit d'exécution — surfaces admin/hôte & mode maintenance (T-179)

- **Date** : 2026-09-01
- **Méthode** : exécution réelle PRODUCTION (preview prod T-178) —
  modération, promotions, utilisateurs, méthode fait ➜ écrit un séjour
  terminé et un avis réel, active/désactive la maintenance, sondes
  anonyme/client/admin sur les pages.

## 1. Éprouvé sain cette passe (aucune correction requise)

| Scénario exécuté | Verdict |
|---|---|
| Modération complète : réglage → avis **pending** → file admin → **approuvé** (visible fiche) → **masqué** (disparaît) + agrégat recalculé | ✅ |
| API maintenance ON : `POST /api/bookings` → **503 MAINTENANCE_MODE** client ; admin traverse | ✅ |
| Gardes d'accès admin/dashboard & redirections login | ✅ (307 propres au proxy) |
| Lecture publique en maintenance | voulue libre au niveau API (seules écritures bloquées) | ✅ |

## 2. Le défaut retenu — la garde « pages » de maintenance est morte

**Constats prouvés en exécution :**

1. Avec `security.maintenanceMode=true`, **les pages du groupe `(main)` ne
   redirigent PAS** (200 avec contenu) alors que le layout appelle
   `redirect("/maintenance")` — prouvé par instrumentation : le layout
   s'exécute, voit `maintenance: true`, appelle `redirect()`… et la page
   sort quand même (effet avalé par le pipeline RSC de Next 16).
2. **La page d'accueil `/` est hors du groupe `(main)`** (`src/app/page.tsx`)
   → jamais couverte par la garde de toute façon.
3. Donc en mode maintenance : seule la garde **API** (503) et la garde
   **client** (`MaintenanceGate`, requiert JS) tenaient — toute navigation
   directe sans JS (lien externe, crawler, JS bloqué) voyait le site
   parfaitement « normal » avec un bandeau… absent.

**Solution — sans casser ce qui fonctionne :**

- La garde remonte **au proxy** (`src/proxy.ts`) — même endroit que les
  autres redirections « vrai 307 » de cette codebase (T-135, T-163) :
  maintenance ON + non-admin + chemin non whitelisté → **307 /maintenance**
  avant tout rendu.
- Whitelist réutilisée (`shouldBypassMaintenance`) : `/connexion`,
  `/inscription`, `/maintenance`, `/api/auth/*`, `/api/admin/*`,
  `/api/health`, assets — **anti-lockout admin inchangé**.
- Sonde DB en échec → **on laisse passer** (loggé, jamais de blocage sur
  indisponibilité).
- Chaque détournement est **traceable** (`console.info` `[proxy]
  maintenance active — redirection …`).
- Le `redirect()` du layout (main) est conservé comme filet secondaire
  (navigations SPA/race) — documenté.
- `/maintenance`, pages `(auth)` tokenisées : déjà hors matcher → aucune
  boucle.

Preuve en prod : 307 `/` `/recherche` `/mes-reservations` (anonyme+client) ;
admin 200 ; `/connexion` 200 ; OFF + TTL 60 s → retour normal. Les TTL
inter-process (deux bundles = deux caches 60 s) sont documentés : passé ce
délai, l'état converge — identique au comportement précédent.
