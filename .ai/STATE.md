# 🧠 ÉTAT DU PROJET (STATE)

> Ce document est la **mémoire officielle** du projet MyBestBooking.
> Il est mis à jour à la **fin de chaque cycle de développement**.
> Source de vérité n°1 : en cas de conflit avec un autre document `.ai/`,
> `STATE.md` prime pour l'état, `CODING_RULES.md` prime pour les règles.

## 📌 Identification

- **Projet** : MyBestBooking
- **Dépôt** : `hamad-sw-ui/MyBestBooking`
- **Branche de session** : `arena/01a01eee-mybestbooking`
- **Dernier commit connu** : `f671ae2` (T-032 xtreme + BUG-018 + BUG-019, Session 11 ter)
- **Dernier commit stable référencé** : `f671ae2` (Session 11 ter)
- **Version du Framework** : **1.1.3** (AI-DOS Web, hybride +
  complétude produit + preuve runtime R20 — voir
  `PROCESS_IMPROVEMENTS.md`, ADR-008)

## 🛠️ État Technique

- **Dernier `npm run typecheck`** : ✅ 0 erreur
- **Dernier `npm run build`** : ✅ succès
- **Dernier `npm test`** : ✅ **176 passed / 176** (0 skipped avec DB
  embarquée démarrée)
- **Dernier `npm run ai:check`** : ✅ **17 OK · 2 warn attendus · 1
  fail cosmétique R7** (STATE.md pointe vers le HEAD à mettre à jour)
- **Dernier `npm run smoke`** : ✅ **91 assertions PASS · 0 FAIL**
  (~30 s, log dans `.ai/REPORTS/smoke_run_2026-08-21_session_11.log`)
- **Dernier `python3 scripts/deep_sim.py`** : ✅ **81 contrôles
  profonds PASS · 0 KO** en ~15 s
- **Dernier `python3 scripts/xtreme_sim.py`** : ✅ **89 contrôles
  extrêmes PASS · 0 KO** en ~80 s (21 sections : sécurité HTTP
  complète, injections XSS/SQL, inputs extrêmes, flow email
  bout-en-bout, flow reset password bout-en-bout, cycle reviews
  complet, availability+rate-plans+stopSell, promotions CRUD, delete
  price-alert, pages dynamiques not-found, audit statique UX
  composants, intégrité seed, contenu emails, webhook Stripe,
  fichiers publics, 2FA à login, CORS, path traversal, cookie
  invalidation, 404/405). Rapport dans
  `.ai/REPORTS/simulation_xtreme_2026-08-21_session_11.md`
- **BUGS trouvés + corrigés Session 11** :
  - BUG-017 (deep_sim) : PATCH /api/users/me n'exposait pas
    priceAlertEnabled
  - **BUG-018** (xtreme_sim) : booking ignorait roomAvailability →
    hôte pouvait pas bloquer les dates
  - **BUG-019** (xtreme_sim) : login n'exigeait pas TOTP après
    activation 2FA (gap sécuritaire)
- **Couverture** : ~119 features ✅ / ~7 sandbox-limited / 0 absent
  (**FEATURES.md ✅ ≈ 97 %**)

## 📈 Compteurs framework (§17, ADR-006)

- **sessions_since_last_product_audit** : `0` (dernier : Session 7,
  après T-023 — voir `REPORTS/audit_produit_2026-08-20_session_7.md`).
  Prochain audit dû ≤ 5 sessions.

## 📋 Sessions

- **Session 1** (2026-08-20) : réécriture `.ai/` (v0 aide-mémoire).
- **Session 2** (2026-08-20) : framework v1.0.0 gouvernance.
- **Session 3** (2026-08-20) : audits tour 1 + tour 2 → v1.0.2.
- **Session 4** (2026-08-20) : T-001→T-010, 14 bugs corrigés,
  framework v1.0.3.
- **Session 5** (2026-08-20) : T-011 (framework v1.1.0 complétude
  produit) + T-012 (disponibilité) + T-013 (emails) + T-014 (uploads)
  + T-015 (6 endpoints). VALIDÉ.
- **Session 6** (2026-08-20) :
  - T-016 (UI branchée + 4 endpoints mineurs + utilitaires promo/annulation)
  - T-017 (SEO + a11y + next/font + CSP + error/not-found/loading +
    BUG-016 JWT jti collision fix)
  - T-018 (calendrier hôte : rate_plans + room_availability)
  - T-019 (tests intégration + Playwright specs)
  - T-020 (Stripe infrastructure PaymentProvider + webhook)
- **Session 7** (2026-08-20, courante) :
  - T-021 (panel d'administration configurable : table `app_settings`,
    endpoints `/api/admin/settings`, module `src/lib/settings.ts`,
    refactor callers TVA/BestRewards/cancellation, UI /dashboard/settings,
    bouton suspend user, ADR-007)
  - T-022 (câblage effectif de `security.maintenanceMode` : module
    `src/lib/maintenance.ts`, page `/maintenance`, guards RSC dans
    3 layouts + guards 503 dans 5 handlers API métier critiques,
    whitelist anti-lockout admin, 11 tests unitaires)
  - T-023 (modération d'avis admin : endpoint `PATCH /api/reviews/[id]/moderate`,
    composant `<ReviewModerateActions>`, recalcul atomique
    averageRating/totalReviews, 5 tests intégration DB-backed)
  - **Audit produit §17** : `REPORTS/audit_produit_2026-08-20_session_7.md`
    (compteur remis à 0)
  - T-024 (audit log global : table `audit_log` migration 0006,
    `src/lib/audit.ts` best-effort, endpoint `GET /api/admin/audit`,
    page `/dashboard/audit`, hooks dans 4 handlers settings/moderate/
    suspend/validate, 5 tests unitaires)
  - T-025 (templates emails éditables : section `emailTemplates` dans
    settings, `src/lib/mail/render.ts` avec escape XSS, refactor des
    4 templates en async, section UI dans `<SettingsPanel>`,
    10 tests unitaires + 1 test XSS)
  - **3 écarts audit corrigés** : `POST /api/reviews/[id]/helpful`
    (endpoint + rate-limit anti-double-clic), select timezone dans
    `<ProfileForm>`, admin peut modifier `commissionRate` par property
    via `PUT /api/properties/[id]` (host reste bloqué 403)

## 🐞 Bugs & Défauts

- **Ouverts** : 0
- **Corrigés (VALIDÉ)** : BUG-001, BUG-002, BUG-004, BUG-005, BUG-006,
  BUG-007, BUG-008, BUG-009, BUG-010, BUG-011, BUG-012, BUG-013, BUG-014,
  BUG-015, **BUG-016** (JWT jti, Session 6), **BUG-003** (paiement,
  infra livrée T-020, credentials Stripe test à fournir)
- **Tâches VALIDÉ** : T-000 v1/v1.1/v1.2/v1.3 + T-001 à T-032 (32 tâches)

## 🏛️ Décisions & ADR

- **ADR-001** : Framework AI-DOS Web hybride (Session 2)
- **ADR-002** : Automatisation hors `.ai/` (Session 3)
- **ADR-003** : JWT_SECRET obligatoire au boot (Session 4)
- **ADR-004** : Protection `/api/seed` en prod (Session 4)
- **ADR-005** : Proxy edge d'auth (Session 4)
- **ADR-006** : Framework étendu à la complétude produit (Session 5)
- **ADR-007** : Panel d'administration configurable — table `app_settings` (Session 7)
- **ADR-008** : Smoke HTTP obligatoire (R20) comme preuve runtime (Session 11)

## 🕒 Dernière Mise à jour

- **Date** : 2026-08-21 (Session 11 — **T-032 R20 smoke_manifest_present
  + scripts/smoke.sh** : framework v1.1.3, R20 bloque le retrait /
  vidage du smoke, script versionné avec 91 assertions HTTP réelles
  (login × 3 rôles, 39 pages, 7 guards body-check, 8 API + 7 scénarios
  métier dont POST /api/bookings complet), `npm run smoke` intégré,
  ADR-008, log capté. Réponse à l'analyse critique de framework qui
  a révélé qu'aucune règle ne testait le comportement runtime.
  176/176 tests, 17 OK 2 warn 1 fail cosmétique (R7 STATE HEAD à
  actualiser au commit))

- **Date précédente** : 2026-08-21 (Session 9 — **T-030 R18 no_dead_ui** :
  framework v1.1.1 durci pour bloquer les liens/handlers morts
  (href="#", onClick={()=>{}}, onChange={()=>{}}) + 7 nouveaux
  composants client livrés pour combler les UI manquantes (2FA
  complète, delete account, referral, prefs notif, price alerts, new
  room form, wallet checkout, guest booking, retrait des liens morts).
  176/176 tests inchangés, R18 vert)

- **Date précédente** : 2026-08-20 (Session 8 — **Sprint 98%** T-026 → T-029 :
  filtres avancés recherche + emails annulation/message + wallet +
  BestRewards discount + delete account + 2FA TOTP + i18n EN + devise
  dynamique + dark mode + guest booking + pièces jointes + rate-limits
  + logger structuré + rotation secret docs. **176/176 tests, 97 %
  couverture ✅, 0 régression**)
- **Agent** : Arena Agent Mode
- **Prochaine mise à jour attendue** : à chaque fin de session — obligatoire
  §11. La règle de mise à jour est vérifiée mécaniquement par
  `npm run ai:check` (17 règles actives).
