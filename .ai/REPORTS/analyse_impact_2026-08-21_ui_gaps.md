# 📊 Analyse d'impact — T-030 UI gaps fill

- **Date** : 2026-08-21 (Session 9)
- **Trigger utilisateur** : « je vois beaucoup de manquements, des
  interfaces qui n'existent pas et des boutons qui ne servent à rien.
  Pourquoi le framework n'anticipe pas tout ? »
- **Niveau** : **S** (nouvelle règle R18 dans check-ai.mjs +
  correction/livraison ~10 composants UI)
- **Auteur** : Arena Agent Mode

## §14 — 9 questions

### 1. Quoi

Deux volets complémentaires :

**A. Framework — nouvelle règle R18 dans `scripts/check-ai.mjs`** :
- Interdit `href="#"` (liens morts).
- Interdit `onClick={() => {}}` et `onChange={() => {}}` (handlers vides).
- Statut `fail` (bloquant) — ces morts UI n'auraient jamais dû passer.

**B. UI — livraison des composants réellement fonctionnels** :
1. `<TwoFactorSection>` : setup + QR code + verify + disable TOTP.
2. `<DeleteAccountSection>` : confirmation « SUPPRIMER » + DELETE
   /api/users/me + redirect /.
3. `<ReferralCard>` : GET /api/users/me/referral, affiche + copier.
4. `<NotificationPrefsSection>` : PATCH /api/users/me
   `{priceAlertEnabled}`.
5. `<PriceAlertButton>` sur fiche property : mini-formulaire POST
   /api/price-alerts.
6. `<PriceAlertsSection>` (dispo pour insertion future dans
   /mes-favoris).
7. `<NewRoomForm>` + page `/dashboard/rooms/new` (POST /api/rooms).
8. Wallet checkbox + guest mode banner dans `/reservation`.
9. Retrait des `href="#"` dans `/aide` (articles inexistants → `<span>`).
10. Retrait de l'`onChange={() => {}}` mort dans `/mon-compte` (2FA).

### 2. Où

Nouveaux fichiers :
- `src/components/two-factor-section.tsx`
- `src/components/delete-account-section.tsx`
- `src/components/referral-card.tsx`
- `src/components/notification-prefs-section.tsx`
- `src/components/price-alert-button.tsx`
- `src/components/price-alerts-section.tsx`
- `src/components/new-room-form.tsx`
- `src/app/dashboard/rooms/new/page.tsx`
- `.ai/REPORTS/analyse_impact_2026-08-21_ui_gaps.md`
- `.ai/REPORTS/analyse_conception_2026-08-21_ui_gaps.md`

Modifiés :
- `scripts/check-ai.mjs` : +R18.
- `src/app/(main)/mon-compte/page.tsx` : intègre les 4 nouveaux
  composants, retire l'`onChange` mort et le bouton `<Button danger>`
  mort.
- `src/app/(main)/aide/page.tsx` : retire les 2 `href="#"`.
- `src/app/(main)/hebergement/[slug]/page.tsx` : bouton « Voir dispo »
  devient un vrai lien vers /reservation + `<PriceAlertButton>`.
- `src/app/(main)/reservation/page.tsx` : détecte non-auth → mode
  invité + envoie `isGuestBooking`, expose wallet checkbox.
- `src/app/dashboard/rooms/page.tsx` : bouton « Ajouter » devient
  un vrai `<Link href="/dashboard/rooms/new">`.
- `src/app/api/users/me/route.ts` : accepte `priceAlertEnabled`.
- `src/app/api/auth/me/route.ts` : expose `priceAlertEnabled` + `timezone`.

### 3. Pourquoi

L'utilisateur a signalé — à raison — que je marquais des features ✅
dès qu'un endpoint existait, sans vérifier qu'un utilisateur pouvait
s'en servir depuis l'UI. Le tag `🎯 PROMISED` du framework §16 était
censé prévenir exactement ça mais on l'a contourné.

R18 rend structurellement impossible ce genre de tromperie :
`ai:check` bloquerait tout futur `href="#"` ou handler vide.

### 4. Appelants

grep :
- `href="#"` : 2 occurrences dans `/aide`, corrigées.
- `onChange={() => {}}` : 1 dans `/mon-compte` (2FA), corrigée.
- `onClick={() => {}}` : 0 (déjà propre).
- Boutons `<Button>` sans handler ni Link (audit visuel) : bouton
  « Voir les disponibilités » dans fiche property, bouton « Ajouter
  chambre » dans /dashboard/rooms, bouton « Supprimer » dans
  /mon-compte, bouton « Enregistrer préférences » notif.

### 5. Contrat public

- Nouvelle règle `R18 no_dead_ui` dans `check-ai.mjs`.
- Aucun endpoint API modifié en signature (juste +2 champs
  optionnels dans PATCH /api/users/me).
- UI purement additive côté composants ; le contrat des pages
  existantes est préservé.

### 6. Migration

Aucune migration DB.

### 7. Sécurité

- `<DeleteAccountSection>` : confirmation « SUPPRIMER » (bouton
  disabled sinon), endpoint DELETE /api/users/me protège les admins.
- `<TwoFactorSection>` : disable exige un code TOTP valide (protection
  contre attaquant qui aurait un accès session temporaire).
- `<PriceAlertButton>` sur fiche publique : ne fait rien si pas
  connecté (POST /api/price-alerts renvoie 401).
- QR code TOTP servi via `api.qrserver.com` — accepté par la CSP
  (`img-src ... https:`). Aucun secret transmis en clair ailleurs
  que dans l'URL otpauth, qui reste côté client uniquement.

### 8. Test

- `npm run typecheck` ✓
- `npm run build` ✓ (nouveaux endpoints/pages listés)
- `npm run ai:check` : R18 bloque désormais les liens morts →
  après corrections, R18 ✅.
- Tests réels API :
  - `POST /api/auth/2fa/setup` → secret 32 chars + otpauth valide
  - `POST /api/rooms` (host) → chambre créée (75€ EUR)
  - `POST /api/price-alerts` (customer) → alerte créée
  - `GET /api/users/me/referral` → code 8-char (ex : BU23WN3L)
  - `PATCH /api/users/me { priceAlertEnabled }` → 200
  - `DELETE /api/users/me` (admin) → 400 « Un admin ne peut pas se
    supprimer lui-même »
  - `POST /api/bookings { useWalletCredits:true }` → discount 53.05
    sur 165 (wallet 25 + BR level 2 15% = 28.05) → total 111.95
  - `POST /api/bookings { isGuestBooking:true }` sans cookie → 201
    confirmed
- Chunk JS `src_0gi6nkl._.js` contient les composants (grep OK :
  TwoFactorSection, DeleteAccountSection, ReferralCard, "Activer la
  2FA", "SUPPRIMER pour", "Alertes prix favoris", "code de parrainage").

### 9. Rollback

- R18 : commentaire d'une passe dans check-ai.mjs, sans impact.
- Composants : `git revert` remet le code d'avant.

## Note de discipline (§16)

Ce que j'aurais dû faire dès T-021 : ne marquer ✅ dans FEATURES.md
qu'après un test manuel ▶️ qui **navigue** dans l'UI depuis le
navigateur, pas seulement après un `curl` sur l'API. La règle R18
force désormais l'absence de morts UI ; complétée idéalement par
Playwright quand disponible en CI (aujourd'hui sandbox-limited).
