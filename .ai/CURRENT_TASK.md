# 🎯 TÂCHE EN COURS

**Tâche :** T-147 — 22e audit fonctionnel profond : analyse à l'exécution
(pages, boutons, scénarios profonds) des éléments inachevés/mal pensés, avec
explication du problème et solution sans régression. Détail :
`REPORTS/audit_fonctionnel_profond22_2026-08-30.md`.

**Méthode :** DEV (3000) puis **PROD `next start` (3009)** avec `CRON_SECRET`
défini ; 3 rôles + anonyme. Environnement restauré (re-clone). Données de test
nettoyées (utilisateurs de test **anonymisés** comme le fait l'admin,
réservations 2028, surcharges calendaires, alerte, conversation orpheline
supprimées ; wallet client démo remis à 25,00 €).

## Défaut corrigé (1 seul, additif — aucun flux touché)

- 🔨 **Messages d'erreur Zod en anglais sur les routes 2FA** :
  `api/auth/2fa/{setup,verify,disable}/route.ts` renvoyaient
  `error.issues[0]?.message` brut → « Invalid input: expected string… »
  lorsqu'un champ requis manquait/avait le mauvais type. Corrigé en utilisant
  `frenchZodMessage(error)` (déjà dans `src/lib/http.ts`, utilisé T-140 sur les
  routes admin) : les messages métier FR personnalisés sont conservés, les
  messages Zod par défaut sont traduits (« Valeur invalide ou manquante »).
  Après correctif, les 3 routes répondent en français ; le flux 2FA complet
  (setup → verify → login totpCode → disable) reste fonctionnel.

## Scénarios profonds vérifiés SAINS

Surbooking (qty 2 : 2 OK, 3ᵉ refusée ; nuits adjacentes OK, chevauchement
refusé) · propriété suspendue non réservable · wallet débité/plafonné ·
codes promo (valide/inconnu/montant invalide) · 2FA bout en bout ·
parrainage (filleul +5 €, parrain +10 € une fois, cron idempotent) ·
**sécurité cron/seed** (prod : seed exige SEED_TOKEN sinon 404 ; cron exige
Bearer CRON_SECRET sinon 401 ; en dev l'auth est volontairement ouverte) ·
annulation (devis, remboursement total, double → 409, IDOR → 403) ·
disponibilité calendaire hôte (availableCount 0 bloque, non-propriétaire 403)
· messagerie (message stocké, compteurs, vide → 400, tiers → 403) · alertes
de prix (création/idempotence/mise à jour/seuil négatif refusé) · page d'aide.

## Remarques non bloquantes (aucune action sans décision)

- Cron ouvert en dev **volontairement** (`NODE_ENV`), sécurisé en prod →
  penser à définir `CRON_SECRET` en production.
- `vercel.json` planifie le cron sans en-tête d'auth (idempotent, effet
  limité) ; à aligner si `CRON_SECRET` activé.
- En prod sans clés Stripe, l'étape de reprise de paiement du cron lève une
  erreur (dette Stripe déjà connue/différée T-145) et fait répondre 500 pour
  tout le cron ; suggestion future : isoler chaque étape dans un try/catch.

**ID** : T-147. **Niveau** : L. **Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-30.

## Sortie (validé — T-147)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288/288 (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (**60 pages**) · `ai:check` **19 OK · 1 warn**.
- Rapport : `.ai/REPORTS/audit_fonctionnel_profond22_2026-08-30.md`.

---

## Avant : T-146 — 21e audit fonctionnel profond (récapitulatif rate plan)

## Avant : T-145 — implémentation des remarques produit (photo de profil,
## commission par hébergement admin, langue « ar ») — CORRIGÉ (VALIDÉ) 2026-08-29

- 🔨 Photo de profil : `POST /api/users/me/avatar` + bouton import dans
  `profile-form.tsx` (tous rôles, magic bytes, 5 Mo, rate-limit).
- 🔨 Carte « Commission plateforme » admin-only dans édition propriété ; envoyée
  au PUT seulement si admin (hôte 403).
- 🔨 Retrait de l'option langue « ar » (seules fr|en sont réelles).
- Sortie : `tsc` 0 · `eslint` 0 · `vitest` 288 · `smoke` 94/94 · build 59 pages
  · `ai:check` 19 OK / 1 warn. Rapport :
  `.ai/REPORTS/validation_T-145_2026-08-29.md`.
- Différé (ressources externes non simulables) : Stripe Connect / payouts et
  vraies clés carte — le code bascule dès que les clés sont fournies.
