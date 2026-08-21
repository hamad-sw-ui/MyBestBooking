# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-030
- **Titre** : R18 no_dead_ui + livraison des UI réellement manquantes
- **Niveau** : **S**
- **Ouverte le** : 2026-08-21 (Session 9)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

Retour utilisateur direct : « je vois beaucoup de manquements, des
interfaces qui n'existent pas et des boutons qui ne servent à rien.
Pourquoi le framework n'anticipe pas ? ». Reproche fondé : j'ai marqué
plusieurs features ✅ en Session 8 dès qu'un endpoint existait, sans
vérifier qu'un utilisateur pouvait s'en servir depuis l'UI (2FA,
delete account, price alerts, referral, wallet checkout, rooms/new,
guest booking, pièces jointes).

## Livrables

### A. Framework — R18 no_dead_ui

- Nouvelle règle dans `scripts/check-ai.mjs` : détecte et **bloque**
  `href="#"`, `onClick={() => {}}`, `onChange={() => {}}`.
- Statut `fail` (bloquant). L'ai:check refuse tout futur retour de
  ces patterns.
- Ajoutée à `blocking_rules` du manifest sous
  `dead_ui_link_or_handler`.

### B. UI — 7 nouveaux composants client

1. `src/components/two-factor-section.tsx` : setup TOTP (secret + QR
   code via `api.qrserver.com`) → verify → disable. Cycle complet.
2. `src/components/delete-account-section.tsx` : confirmation par
   saisie « SUPPRIMER » avant `DELETE /api/users/me`.
3. `src/components/referral-card.tsx` : `GET /api/users/me/referral`
   + copier via `navigator.clipboard`.
4. `src/components/notification-prefs-section.tsx` :
   `PATCH /api/users/me { priceAlertEnabled }`.
5. `src/components/price-alert-button.tsx` : sur fiche property, mini
   formulaire prix max → `POST /api/price-alerts`.
6. `src/components/price-alerts-section.tsx` : liste + suppression
   des alertes user.
7. `src/components/new-room-form.tsx` : formulaire complet →
   `POST /api/rooms`.

### C. Nouvelles pages / refactor pages

- `src/app/dashboard/rooms/new/page.tsx` : hôte ajoute une chambre.
- `/mon-compte tab security` : intègre `<TwoFactorSection>` +
  `<DeleteAccountSection>` (retire toggle mort et bouton `<Button>`
  disabled).
- `/mon-compte tab notifications` : `<NotificationPrefsSection>` +
  `<ReferralCard>` (remplace 5 toggles décoratifs + bouton mort).
- `/reservation` : détection non-auth → mode invité automatique avec
  bannière ; wallet checkbox si `walletBalance > 0` ; envoie
  `useWalletCredits` et `isGuestBooking` au POST.
- `/hebergement/[slug]` : bouton « Voir les disponibilités » devient
  un vrai `<a href="/reservation?...">` + `<PriceAlertButton>`.
- `/aide` : retire 2 `href="#"` (articles inexistants → texte simple).
- `/dashboard/rooms` : bouton Ajouter devient `<Link>` vers
  `/dashboard/rooms/new`.

### D. APIs mineurement enrichies

- `PATCH /api/users/me` : accepte `priceAlertEnabled: boolean`.
- `GET /api/auth/me` : expose `priceAlertEnabled` et `timezone`.

## Preuves (§16)

- 🔍 `REPORTS/analyse_impact_2026-08-21_ui_gaps.md`.
- 🔍 `REPORTS/analyse_conception_2026-08-21_ui_gaps.md`.
- 🔨 `npm run typecheck` ✅ 0 erreur.
- 🔨 `npm run build` ✅ succès (nouveaux endpoints/pages listés :
  `/dashboard/rooms/new`, `/api/auth/2fa/*` déjà présents).
- 🔨 `npm run lint` ✅ 0 error.
- 🧪 `npm test` : **176 / 176** verts (inchangé, aucune régression).
- 🧪 `npm run ai:check` : **R18 no_dead_ui ✅**, R15 UI↔API ✅,
  15 OK · 2 warn attendus · 0 fail.
- ▶️ `POST /api/auth/2fa/setup` (customer) → secret 32 chars +
  otpauth URI valide.
- ▶️ `POST /api/rooms` (host, sur sa property) → chambre 75€ créée.
- ▶️ `POST /api/price-alerts` (customer) → alerte 201.
- ▶️ `GET /api/users/me/referral` (customer) → code `BU23WN3L` (8
  chars alphabet lisible).
- ▶️ `PATCH /api/users/me { priceAlertEnabled: true }` → 200.
- ▶️ `DELETE /api/users/me` (admin) → 400 « Un admin ne peut pas se
  supprimer lui-même ».
- ▶️ `POST /api/bookings { useWalletCredits: true }` (customer wallet
  25€ + BestRewards level 2) : subtotal 150, taxes 15, discount
  **53.05** (wallet 25 + BR 15% de 165 = 28.05), total 111.95.
- ▶️ `POST /api/bookings { isGuestBooking: true }` sans cookie →
  201 confirmed, user stub créé.
- ▶️ Inspection du bundle JS `src_0gi6nkl._.js` (238 KB) confirme
  la présence des composants : `TwoFactorSection`,
  `DeleteAccountSection`, `ReferralCard`, « Activer la 2FA »,
  « SUPPRIMER pour », « Alertes prix favoris », « code de parrainage ».
- ▶️ Grep post-modification : `href="#"` = **0**, `onClick={()=>{}}` = **0**,
  `onChange={()=>{}}` = **0**.

## Non-régression

- 176/176 tests inchangés.
- Signatures API existantes préservées (PATCH users/me accepte
  `priceAlertEnabled` en plus, les callers actuels continuent de
  fonctionner).
- Les 15 URL testées Session 8 répondent toujours 200.

## Framework — v1.1.1

- Manifest bumped 1.1.0 → 1.1.1.
- Blocking rule `dead_ui_link_or_handler` ajoutée.
- R18 sera opposable à toute future soumission.

## Étape suivante

Attente prochaine directive utilisateur.
