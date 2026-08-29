# 🎯 TÂCHE EN COURS

**Tâche :** T-146 — 21e audit fonctionnel profond : analyse à l'exécution
(pages, boutons, scénarios) des éléments inachevés/mal pensés, avec explication
du problème et solution sans régression. Détail :
`REPORTS/audit_fonctionnel_profond21_2026-08-29.md`.

**Méthode :** exécution DEV (3000) puis **PROD `next start` (3009)**, 3 rôles
(client/hôte/admin) + anonyme. Données de test créées puis nettoyées (37
réservations, 0 en 2028, 0 rate-plan/propriété de test).

## Défaut corrigé (1 seul, additif — aucun calcul/paiement touché)

- 🔨 **P2 — Récapitulatif tunnel de réservation : la remise du tarif (rate plan)
  était comptée deux fois dans le détail.** `src/app/(main)/reservation/page.tsx`
  affichait `subtotal` (déjà remisé) sur la ligne « N nuits × €tarif/nuit », puis
  re-soustrayait la remise sur la ligne verte → détail arithmétiquement faux
  (ex. 2×118,67 : 213,61 − 23,73 + 21,36 = 211,24 au lieu de 234,97). Le **Total
  final et le calcul serveur restaient justes** (le serveur recalcule).
  Correctif : afficher `baseSubtotal` (nuits × tarif) sur cette ligne. Sans rate
  plan, `baseSubtotal === subtotal` → aucun changement.

## Point documenté (connu, déjà mitigé — pas de code modifié)

- ℹ️ **Soft-404 HTTP 200 :** `notFound()` pendant le rendu RSC streamé renvoie un
  code **200** (corps = page 404) car `src/app/loading.tsx` démarre le streaming
  (vérifié : sans `loading.tsx`, `notFound()` renvoie bien 404). Comportement
  documenté Next 16 (loading.md « Status codes »). Déjà mitigé T-135 via
  `<meta robots noindex>` (vérifié présent sur fiches/tokens absents, absent des
  pages valides). Impact résiduel : analytics/conformité seulement. Solution
  recommandée sans risque : `proxy.ts` avec vérification de slug avant streaming
  — non appliquée (ajout de latence/DB sur le chemin critique) ; à ne faire que
  si une exigence de conformité l'exige. Ne pas retirer `loading.tsx` (perte du
  spinner).

## Scénarios vérifiés SAINS (sélection)

Paiement mock/Stripe · rate plans API + application réelle −10 % + formulaire
hôte complet · contact hôte pré-résa · propriété suspendue (invisible, fiche
404, **réservation bloquée** 400) · IDOR réservations/facture/devis/avis → 403 ·
modération propriétés (pending→approve admin, hôte 403) · avis (après séjour
uniquement) · partage wishlist (rotation invalide l'ancien token) · auth
(logout, forgot/reset sans fuite, change-password fr) · avatar · recherche (0
résultat, tri prix) · promotions admin-only · audit/analytics admin. Aucun lien
mort ni handler vide (R18/R19 OK).

**ID** : T-146. **Niveau** : L. **Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-146)

- 🔨 `tsc` 0 · `eslint` 0 (1 warning `<img>` préexistant, non lié).
  🧪 `vitest` **288 (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **60 pages**) ·
  `ai:check` **19 OK · 1 warn · 0 fail**.
- Rapport : `.ai/REPORTS/audit_fonctionnel_profond21_2026-08-29.md`.

---

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
