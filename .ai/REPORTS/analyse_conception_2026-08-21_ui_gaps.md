# 🧠 Conception — T-030 UI gaps fill

- **Date** : 2026-08-21 (Session 9)

## Problème

Voir `analyse_impact_2026-08-21_ui_gaps.md`. Deux volets :
1. Le framework laissait passer des `href="#"` et handlers vides.
2. Les endpoints /api/auth/2fa, /api/price-alerts, /api/users/me/referral
   et DELETE /api/users/me étaient livrés en Session 8 mais aucune UI
   ne les appelait.

## Options considérées

### A. Framework — R18 statique vs Playwright

- **Retenu** : règle statique R18 dans `check-ai.mjs`, grep sur
  `href="#"`, `onClick={() => {}}`, `onChange={() => {}}`. Rapide,
  déterministe, exécutable à chaque commit.
- **Écarté** : Playwright headless — bloqué en sandbox (CDN Chromium
  indispo). Sera complémentaire en CI hébergée.

### B. UI — composants inline vs client dédiés

- **Retenu** : 7 composants client dédiés (`<TwoFactorSection>`,
  `<DeleteAccountSection>`, etc.) pour isolation, réutilisation
  possible, tests unitaires faciles à greffer.
- **Écarté** : tout inline dans `/mon-compte` — augmente le code de
  la page principale et empêche la réutilisation.

### C. QR code 2FA — lib npm vs service externe

- **Retenu (V1)** : URL image `api.qrserver.com` (aucun secret
  supplémentaire ne transite : l'URI otpauth EST le secret et reste
  côté navigateur user). CSP `img-src https:` autorise.
- **Alternative future** : bibliothèque `qrcode` locale rendue en
  `<canvas>` ou data URL — pas d'appel externe. À faire quand le
  besoin de rester 100 % local le justifie (RGPD strict, air-gap).

### D. Guest booking UI

- **Retenu** : plutôt que rediriger vers /connexion, la page
  /reservation détecte l'absence d'auth et bascule automatiquement
  en mode invité + affiche une bannière avec lien vers /inscription.
  L'utilisateur peut réserver sans compte immédiatement.
- **Écarté** : checkbox « je préfère continuer sans compte » avant
  redirection — plus friction.

## Architecture

```
Framework layer
  check-ai.mjs
   └── R18 no_dead_ui
        └── grep src/**/*.tsx pour href="#", onClick={()=>{}},
            onChange={()=>{}}
        └── fail (bloquant) si un pattern est trouvé

UI layer
  /mon-compte
   ├── tab security → TwoFactorSection + DeleteAccountSection
   └── tab notifications → NotificationPrefsSection + ReferralCard
  /hebergement/[slug]
   ├── CTA "Voir dispo" → <a href="/reservation?..."> (vrai lien)
   └── PriceAlertButton
  /reservation
   ├── détecte auth → sinon guestMode + bannière
   └── walletBalance>0 → checkbox useWalletCredits
  /dashboard/rooms
   ├── bouton "Ajouter" → <Link href="/dashboard/rooms/new">
   └── /dashboard/rooms/new → NewRoomForm → POST /api/rooms
```

## Plan de migration

1. R18 ajoutée + tests que les patterns existants sont détectés.
2. 7 composants client livrés.
3. Refactor /mon-compte, /reservation, /hebergement, /aide,
   /dashboard/rooms.
4. Tests API réels + inspection du bundle JS pour confirmer que les
   composants sont bien inclus.
5. Docs `.ai/`.

Aucune migration DB. Zéro régression testée.

## Débat multi-rôles §15.2

Non requis (niveau S consensus).
