# 🎯 TÂCHE EN COURS

**ID** : T-160 (audit n°30 — analyse à l'exécution, rapport seul)

**Niveau de proportionnalité** : S (analyse seule, aucun code ; 7 findings :
2 P2, 5 P3 — solutions proposées, implémentation à arbitrer)

**Titre** : Audit n°30 à l'exécution — « Mes favoris » pollué (123 listes
d'artefacts + N+1), alertes prix acceptées pour des dates passées (jamais
expirées), i18n public vague 2 (5 pages FR malgré langue EN), 404 de partage
en HTTP 200, label devise FR au SSR, liens e-mail relatifs si APP_URL
manquante, hygiène des runs (votes/favoris).

**Statut** : **EN COURS (rapport d'audit rendu)** — T-159 (audit n°29) est
CORRIGÉ (VALIDÉ). Preuves : `.data/a30/audit.mjs` (sessions réelles
customer/host/admin, mutations nettoyées) + vérifications HTTP avec cookie
`mybb:ui-language=en` (5 pages publiques) + inspection code (N+1, route
price-alerts, templates e-mail) + état DB (123 wishlists/votes laissés).

Rapport : `.ai/REPORTS/audit_fonctionnel_profond30_2026-08-30.md`.

## Synthèse des findings (code T-160 → T-166)

- 🟠 **T-160 (P2)** — Favoris : 123 wishlists d'artefacts (`rate-test-*`,
  « Public share test » ×2, « Voyage été 2027 » ×2, ~120 vides) + N+1
  (124 requêtes page) + compteur non dédupliqué. → purge étendue + refactor
  jointure/count + cleanup runner.
- 🟠 **T-161 (P2)** — `POST /api/price-alerts` accepte des dates passées
  (201 prouvé) ; cron n'expire jamais. → validation `checkIn >= today` +
  désactivation cron (`active=false`).
- 🟠 **T-162 (P2)** — i18n vague 2 : `/confidentialite`, `/mentions-legales`,
  `/bestrewards`, `/reservation`, `/wishlists/share/[token]` restent FR
  avec langue EN (titres « Politique de confidentialité… », « Liste
  partagée »). → pattern validé `getServerLocale()` + `makeT` +
  `generateMetadata`.
- 🟢 **T-163 (P3)** — token de partage invalide → UI 404 mais **HTTP 200**
  (streaming ; API renvoie 404). → `notFound()` dans `generateMetadata`.
- 🟢 **T-164 (P3)** — sélecteur devise : label SSR « Devise d'affichage »
  même en EN (hook initialise `language:null`). → prop `initialLanguage`.
- 🟢 **T-165 (P3)** — e-mails : `NEXT_PUBLIC_APP_URL ?? ""` → liens relatifs
  sans config. → helper `appBaseUrl()` + repli documenté.
- 🟢 **T-166 (P3)** — hygiène : votes/wishlists/alertes des runs non
  nettoyées (preuve : 1er vote « utile » → 409 vote préexistant). →
  `cleanup_db` runner étendu.

## Vérifié fonctionnel (aucun problème)

- Messagerie E2E (conversation/envoi/400 vide/unread/lecture) ;
  avis utile 2e vote 409 ; alerte future 201+DELETE ; API partage token
  inconnu 404 ; gardes dashboard (host 307 admin-only, admin 200) ;
  footer/nav localisés EN ; `/aide` EN ; sélecteur devise rendu ; filtres
  prix 200.
