# Audit fonctionnel profond n°30 — MyBestBooking
**Date** : 2026-08-30 · **Objet** : analyse profonde des scénarios et éléments fonctionnels à l'exécution (pages, boutons, fonctionnalités) **inachevés et/ou mal pensés** — problème + solution **sans régression**. Rapport seul (implémentation à arbitrer, comme le cycle n°28).

---

## 1. Méthode et preuves

- **Environnement** : branche `arena/01a052ed-mybestbooking` (HEAD `e12473d`), Next dev :3000, Postgres 55432, seed : 8 users · 10 propriétés · 29 chambres · 51 réservations.
- **Sondes runtime** (`.data/a30/audit.mjs`, sessions réelles customer/host/admin ; mutations nettoyées) + **vérifications HTTP** ciblées (`curl` cookie `mybb:ui-language=en`).
- **Vérifié fonctionnel (aucun problème)** :
  - messagerie E2E : conversation depuis une résa → 201, envoi → 201, message vide → 400, hôte voit la conversation, `unreadByHost=1`, lecture → 200 (nettoyée) ;
  - avis « utile » : 2e vote → **409** idempotent (bon comportement) ;
  - alerte prix dates futures → 201 + suppression → 200 ;
  - `/api/wishlists/shared/<token inconnu>` → **404** `{error:"Introuvable"}` ;
  - gardes dashboard : host → 307 sur admin-only (promotions/audit/users), admin → 200 partout ; analytics/bookings host 200 ;
  - footer/nav **localisés** avec cookie `en` (Help center/Legal notice/My bookings…), titre `/aide` EN (acquis n°29) ;
  - `/recherche` : sélecteur devise rendu (options EUR/USD/GBP/XAF) + filtres prix 200.

---

## 2. Findings — problème + solution

### 🟠 F1 — P2 (T-160) : « Mes favoris » pollué par 123 listes d'artefacts + requête N+1
**Problème (preuves)** : `GET /api/wishlists` (customer) → **123 wishlists** : `rate-test-17881258…-9` (une par run de simulation), doublons « Public share test » ×2, « Voyage été 2027 » ×2, ~120 listes **vides** (3 items au total). Causes : les sims créent des listes sans les supprimer, `run_all_sims.py`/`purge-sim-data.mjs` ne nettoient pas les wishlists. Conséquences : (a) la page `Mes favoris` affiche 123 cartes de listes → expérience inutilisable ; (b) `getWishlists()` (page) fait **1 requête par liste** = **124 requêtes** (N+1) ; rendu mesuré 0,69–0,92 s (dev, mono-requête — dégradation réelle en prod) ; (c) le compteur « X hébergements » somme les items de toutes les listes (un même bien dans 2 listes compté 2×), le rendu `flatMap`).
**Solution (additive, aucun contrat changé)** :
1. `purge-sim-data.mjs` : règle `wishlists` d'artefacts (préfixe `rate-test-`, noms `Public share test`/`Voyage été 2027`, listes vides créées par les runs) avec `--dry-run` par défaut ;
2. `run_all_sims.py cleanup_db` : suppression des wishlists créées par le run en cours (ou les sims suppriment après test) — fin de l'accumulation ;
3. refactor `getWishlists()` : une seule requête (`leftJoin` + `count`) au lieu du N+1, compteur dédupliqué par `propertyId` (`Set`) — rendu identique pour les cas normaux.

### 🟠 F2 — P2 (T-161) : alerte prix acceptée pour des dates **passées** (jamais expirée)
**Problème (preuve)** : `POST /api/price-alerts` avec `checkIn=2020-01-10/checkOut=2020-01-12` → **201** (aucune validation « dates futures ») ; le cron (`/api/cron/price-alerts`) ne désactive jamais une alerte dont `checkOut < today` → quote inutile à chaque run, et si des lignes de disponibilité portent ces dates passées → **notification « pour votre séjour » d'un séjour révolu**.
**Solution** :
1. validation serveur `checkIn >= today` (400, message français via `frenchZodMessage`) dans le POST ;
2. cron : `checkOut < today` → `active=false` (conservateur préférable à la suppression) + log ;
3. tests : POST dates passées → 400 ; alerte expirée désactivée — **aucune migration**, contrat existant (alerte valide) inchangé.

### 🟠 F3 — P2 (T-162) : i18n vague 2 — pages publiques encore 100 % FR malgré la langue EN
**Problème (preuves)** : avec `Cookie: mybb:ui-language=en` :
- `/confidentialite` → `<title>Politique de confidentialité | MyBestBooking</title>` ;
- `/mentions-legales` → `<title>Mentions légales | MyBestBooking</title>` ;
- `/bestrewards` → `<title>BestRewards — programme fidélité | MyBestBooking</title>` ;
- `/reservation` → `<title>MyBestBooking — Réservez mieux. Voyagez plus.</title>` + « Informations de réservation manquantes » visible ;
- `/wishlists/share/<token>` → **aucun `generateMetadata`** (titre du layout) + « Liste partagée » en dur + « X hébergement(s) ».
Le travail n°29 a couvert la fiche propriété/help-center ; ces 5 pages publiques restent FR (le garde-fou i18n liste déjà 460 lignes/66 fichiers).
**Solution** : réutiliser le pattern validé — `getServerLocale()`+`makeT` dans les pages serveur, `generateMetadata` localisé (métadonnées + libellés + pluriels), clés fr/en dans `ui-strings.ts`. Pour la page partage : contenu localisé + `generateMetadata` (évite le titre du layout). Aucun changement de contrat/API ; le français reste le défaut.

### 🟢 F4 — P3 (T-163) : token de partage invalide → UI 404 correcte mais **HTTP 200**
**Problème (preuve)** : `/wishlists/share/__t__` → **HTTP 200** avec le rendu local du `not-found.tsx` (« Cette page n'existe pas ou plus… »). L'API renvoie bien 404, mais la page `notFound()` intervient **après le début du flux** (page `force-dynamic` + `headers()` + fetch interne) → statut déjà 200 envoyé. Impact : URLs de partage exposées publiquement (partage = usage principal) → référencement/HTTP sémantique faux.
**Solution** : exécuter la validation dans `generateMetadata` (appel de la ressource + `notFound()` **avant** le rendu → Next renvoie un vrai 404, et la donnée est réutilisée pour la page : pas de double fetch). Aucun changement de contrat.

### 🟢 F5 — P3 (T-164) : sélecteur de devise — label SSR en français pour un visiteur EN (flash)
**Problème (preuve)** : HTML de `/recherche?city=Paris` avec cookie `en` → `aria-label="Devise d'affichage"` (le hook `useDisplayPreferences` initialise `language:null` → repli FR côté serveur) ; bascule en anglais seulement après hydratation → micro-flash + HTML serveur incohérent avec la langue.
**Solution** : prop `initialLanguage` au `CurrencySelector` alimentée par `getServerLocale()` (SSR) — le hook conserve sa logique (compte > localStorage > plateforme) ; additif.

### 🟢 F6 — P3 (T-165) : e-mails avec liens **relatifs** si `NEXT_PUBLIC_APP_URL` manque
**Problème (code)** : `process.env.NEXT_PUBLIC_APP_URL ?? ""` dans `templates.ts` (notification/cancellation hôte) et le cron price-alerts → si la variable n'est pas définie (déploiement, preview), les boutons/liens des e-mails deviennent `/dashboard/bookings` (relatif, inutilisable dans un client mail ; l'e-mail de l'alerte prix renvoie vers `/hebergement/…`).
**Solution** : helper unique `appBaseUrl()` (repli documenté `https://mybestbooking.com`), validation au démarrage (`console.warn` si absent), remplacement des 3 usages — aucune modification du contenu des e-mails ni de l'API.

### 🟢 F7 — P3 (T-166) : hygiène des runs — traces de votes/alertes/favoris non nettoyées
**Problème (preuve)** : 1er POST `/api/reviews/<id>/helpful` sur l'avis du seed → **409** (vote préexistant laissé par un run ; nettoyé ensuite), et 123 wishlists (F1) : `cleanup_db` du runner ne supprime ni `review_votes`, ni `wishlists`, ni `price_alerts` des tests.
**Solution** : étendre `run_all_sims.py cleanup_db` (+ `purge-sim-data.mjs --apply`) : suppression des votes/wishlists/alertes **créés par les runs** (critères explicites : user seed + motifs de test), jamais de suppression aveugle de données réelles.

---

## 3. Bilan

| Find. | Sév. | Domaine | Preuve runtime | Solution (sans régression) |
|---|---|---|---|---|
| F1/T-160 | P2 | Favoris (UX+perf) | 123 listes ; N+1 124 req ; 0,7 s | purge + refactor jointure + compteur dédupliqué |
| F2/T-161 | P2 | Alertes prix | dates 2020 → 201 | validation ≥ today + désactivation cron |
| F3/T-162 | P2 | i18n public | 5 pages titres FR avec cookie en | pattern `getServerLocale`+`makeT` (existant) |
| F4/T-163 | P3 | 404/SEO | token invalide → HTTP 200 | `notFound()` dans `generateMetadata` |
| F5/T-164 | P3 | i18n micro | label FR SSR avec cookie en | prop `initialLanguage` SSR |
| F6/T-165 | P3 | E-mails | `APP_URL ?? ""` | helper `appBaseUrl()` unique |
| F7/T-166 | P3 | Hygiène | 409 vote préexistant | cleanup runner étendu |

**Non-régression garantie par construction** : toutes les solutions sont additives (aucune migration, aucun contrat API public modifié, aucun champ supprimé) et s'appuient sur des mécanismes déjà validés (n°29). Le comportement voyageur, devises, frais d'annulation, gardes de rôles et contrats d'e-mails restent identiques pour les cas existants.

**Prochain jalon** : arbitrage → implémentation T-160→T-166 sur demande (même cycle que n°28→n°29).
