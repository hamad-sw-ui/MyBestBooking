# Validation — audit n°7, lot B (C3 → T-267, C4 → T-268)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Périmètre** : constats **C3** (annonce sans photo servie avec la photo d'une autre
  propriété) et **C4** (claim invité laissant `emailVerified = false`) de l'audit n°7.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md` § 3 (C3, C4)
- **Analyse d'impact** : `analyse_impact_T265_T270_2026-09-11_audit7.md` (antérieure au code, §14)

## 1. Livré

| Tâche | Constat | Livrable |
|---|---|---|
| **T-267** | C3 — `placeholder-property.jpg` était **documentée** (seed-images.ts) comme copie de `villa-azure-1.jpg` : une annonce sans photo servait la photo **d'une autre propriété** (visuel principal + 4 slots de galerie + carte) | (a) le fichier est remplacé par un **visuel neutre dédié** (fond dégradé abstrait, sans photo de bien, 1536×1024 comme l'ancien) — swap de fichier, zéro code pour les 3 consommateurs ; le commentaire `seed-images.ts` est corrigé (l'alias n'existe plus, avertissement « ne jamais recopier depuis un visuel de bien réel ») ; (b) la fiche publique : quand l'annonce n'a **aucune** photo (`!mainImage && images.length === 0` — exactement le cas du placeholder), la grille de substitution est remplacée par un **état vide explicite** « Pas encore de photos pour cet hébergement » (`property.noPhotos` FR/EN, `data-testid="no-photos"`), et plus aucune image de substitution n'est servie (le cas `mainImage` sans `images` rend la photo réelle pleine largeur au lieu de 4 faux slots) ; la carte de liste garde son fallback unique (rendu honnête par le (a)) |
| **T-268** | C4 — la branche `claimGuest` de `POST /api/auth/reset-password` posait `passwordHash` (+ session) mais pas `emailVerified` : le bouton « renvoyer la vérification » s'affichait dans `/mon-compte` juste après un claim qui vient de **prouver** la maîtrise de la boîte mail | la mise à jour utilisateur pose aussi `emailVerified: true` **uniquement** dans la branche `claimGuest` (spread conditionnel, même transaction que le mot de passe) ; le flux historique (mot de passe oublié) et l'inscription classique sont strictement inchangés |

## 2. i18n

- **1 clé ajoutée** FR/EN appariée : `property.noPhotos` (« Pas encore de photos pour cet
  hébergement » / « No photos for this property yet »). Verrou `src/lib/ui-strings.test.ts` :
  **1769 → 1770** (T-267 du lot B ; le lot A avait posé 1768 → 1769).

## 3. Preuves automatisées

- `src/app/(main)/hebergement/no-photos.t267.test.ts` — **2/2** (base réelle, rendu RSC) :
  1. annonce sans `mainImage` ni `images` → `data-testid="no-photos"` + « Pas encore de photos
     pour cet hébergement », **0** occurrence de `placeholder-property` ou `villa-azure` dans le
     HTML ;
  2. annonce du seed avec photos → pas d'état vide, pas de placeholder, la vraie photo
     (`bb-toscana-1.jpg`) servie.
- `src/app/api/auth/reset-password/route.t268.test.ts` — **2/2** (base réelle, tokens réels,
  `next/headers` mocké pour la création de session) :
  1. token `guest_claim` + `claimGuest: true` → 200, mot de passe posé **et**
     `email_verified = true` ;
  2. token `password_reset` (sans `claimGuest`) → 200, mot de passe posé, `email_verified`
     **inchangé** (`false`) — le périmètre du correctif est le claim.
- Non-régression : `ui-strings` (verrou 1770) + `seed-images` (contrat de résolution
  locale/distante) → **10/10** ; `tsc --noEmit` 0 · `eslint src --max-warnings 0` 0/0.

## 4. Vérification runtime (serveur réel, `:3000`)

- Annonce créée sans photo puis approuvée (admin) → fiche publique **200** : bloc
  « Pas encore de photos pour cet hébergement » rendu, **0** référence `placeholder-property`,
  **0** `villa-azure` (le fichier swapé est le visuel neutre).
- (Lot A, même passe) scénario N1 rejoué de bout en bout : demande → confirmation →
  `markPaidOffline` → annulation (remboursement 270,85 € `pending`) → `/mes-reservations`
  affiche « Remboursement : 270,85 € (**à traiter par l'hébergeur**) » — plus de « en cours ».

## 5. Portée

- Le swap de fichier n'a d'effet que sur les annonces **sans photo** (les 8 annonces seed ont
  leurs propres photos : aucun changement visible existant).
- L'état vide est branché sur la condition exacte du placeholder (aucune photo) ; les galeries
  existantes (1, 2… photos) rendent le même markup qu'avant.
- T-268 ne touche que la branche `claimGuest` : ni le mot de passe oublié, ni la vérification
  d'inscription, ni la garde « profil invité sans mot de passe » de `POST /api/bookings` ne
  changent de comportement.
- Toutes les fixtures runtime (annonce sans photo, réservation d'essai, e-mails d'outbox,
  audit_log, sessions de test) ont été purgées : base à l'état seed exact (8 users / 8
  properties / 35 bookings / 0 outbox / 0 audit_log / 0 sessions).
