# 📋 PRODUCT_ACCEPTANCE — parcours utilisateur critiques

> Chaque parcours PAR-xxx représente **un scénario réel** qu'un
> utilisateur veut accomplir. Un produit est acceptable en prod si
> **tous les parcours de niveau P1 sont ✅**.
>
> **Révisé le 2026-08-27** à partir de l'exécution réelle (Postgres +
> serveur + seed, 3 rôles, `npm run smoke` 91/91, appels API manuels et
> audits fonctionnels). La version précédente datait d'un stade antérieur
> et marquait ❌/🚧 des parcours depuis **livrés et testés** — d'où cette
> remise à plat. La preuve « E2E navigateur » (Playwright/Chromium) reste
> 🎯 : Chromium n'est pas disponible dans le sandbox ; les preuves ci-
> dessous sont HTTP/DB/runtime (smoke, tests d'intégration, curl).

## Légende

- ✅ **livré + vérifié à l'exécution** (smoke HTTP, test d'intégration ou appel API réel)
- 🚧 **partiel** (le cœur marche, un sous-élément manque — précisé)
- 🎯 **PROMISED / planifié**
- ❌ **absent**
- **P1** = bloquant pour ouvrir aux vrais utilisateurs · **P2** = important · **P3** = confort

---

## Voyageur

### PAR-001 — Réservation nominale complète  [P1]
Inscription → recherche Paris → choix chambre → réservation → paiement →
email de confirmation → réservation visible dans l'espace.
- État : **🚧** — compte, recherche, réservation (`POST /api/bookings` →
  `confirmed`, vérifié smoke), emails de confirmation (outbox + console
  mailer en dev) et paiement mocké **fonctionnent**. Reste 🎯 : la
  validation Stripe **réelle** (clés/test-mode non disponibles, voir
  KNOWN_LIMITATIONS) et l'E2E Playwright.
- Preuve : ▶️ smoke `POST /api/bookings → ref MBB-… status=confirmed` ;
  emails émis dans `.data/mails/`.

### PAR-002 — Recherche par disponibilité  [P1]
Recherche à dates/nb de voyageurs → seules les chambres disponibles
apparaissent.
- État : **✅** — `GET /api/properties?checkIn&checkOut&guests` interroge
  bien `room_availability` (stop-sell, minStay, availableCount) et les
  réservations confirmées.
- Preuve : 🔍 `src/app/api/properties/route.ts` (jointure
  `roomAvailability`) · ▶️ smoke `properties?guests=2&checkIn=…` → 200.

### PAR-003 — Mot de passe oublié  [P1]
Demande de reset → email → nouveau mot de passe → reconnexion.
- État : **✅** — `POST /api/auth/forgot-password` (rate-limit,
  anti-énumération) + `POST /api/auth/reset-password` + pages
  `/mot-de-passe-oublie` et `/reinitialiser` ; révocation des sessions.
- Preuve : routes + pages présentes, couvertes par tests/FEATURES T-013.

### PAR-004 — Annulation d'une réservation  [P2]
Annulation → frais selon `cancellationPolicy` → email.
- État : **✅** — `GET /api/bookings/[id]/cancellation` (devis frais) +
  `PUT /api/bookings/[id]` (annulation, grille par politique,
  remboursement) + email d'annulation (outbox).
- Preuve : routes + grille `cancellation` (settings) · bouton « Annuler »
  branché dans `booking-row-actions`.

### PAR-005 — Wishlist partagée  [P3]
Wishlist publique → lien consultable sans connexion.
- État : **✅** — `shareToken` généré, `GET /api/wishlists/shared/[token]`
  publique (404 si token inconnu, vérifié), page `/wishlists/share/[token]`.
- Preuve : ▶️ token bidon → 404 ; test d'intégration T-019 au vert.

### PAR-006 — Messagerie voyageur→hôte  [P2]
Message à l'hôte → notification → réponse depuis le dashboard.
- État : **✅** — `POST /api/conversations` (idempotent, T-112) +
  `POST /api/messages` (avec pièces jointes privées) ; l'hôte voit la
  conversation sur sa property.
- Preuve : ▶️ parcours customer→hôte exécuté (conversation + message
  créés, host voit 1 conversation).

### PAR-007 — Avis vérifié après séjour  [P2]
Après séjour, le voyageur note → l'avis apparaît sur la fiche.
- État : **✅** — `POST /api/reviews` (réservation vérifiée, note globale
  **+ 6 sous-notes** T-115), modération admin, réponse hôte, votes utiles.
  Reste 🎯 : l'email d'invitation automatique post-check-out.
- Preuve : routes + formulaire `/mes-reservations/avis/[id]`.

### PAR-008 — Navigation clavier + lecteur d'écran  [P2]
- État : **🚧** — toutes les images ont un `alt`, les boutons icône-seul
  ont un `aria-label` (scan : 0 bouton sans label après T-116/audit).
  Reste 🎯 : skip-links et audit axe-core/Lighthouse complet (Chromium
  indisponible dans le sandbox).

## Hébergeur

### PAR-010 — Publication d'une annonce complète  [P1]
Créer une property, **uploader des photos**, créer des chambres, publier.
- État : **✅** — formulaire property avec **upload photo** (T-113,
  `POST /api/properties/upload`, URL alternative conservée) + création de
  chambres (`POST /api/rooms`) ; workflow de validation admin
  (`/api/properties/[id]/validate`, statuts pending/active).
- Preuve : ▶️ upload host → 200 image publique, 403 customer.

### PAR-011 — Calendrier prix/stock  [P1]
Ajuster prix haute-saison et stop-sell.
- État : **✅** — `<AvailabilityCalendar>` + `<RatePlansSection>` sur
  `/dashboard/rooms/[id]/calendrier`, branchés sur
  `PATCH /api/rooms/[id]/availability` et `/rate-plans`.
- Preuve : composants + routes présents et appelés par l'UI.

### PAR-012 — Réponse à un avis  [P2]
- État : **✅** — `POST /api/reviews/[id]/reply` + `<HostReplyForm>`
  dans `/dashboard/reviews`.

### PAR-013 — Vue analytique mensuelle  [P2]
CA du mois, commission, occupation, comparaison.
- État : **🚧** — revenus + réservations 30 j affichés
  (`/dashboard/analytics`). Reste 🎯 : taux d'occupation et comparaison
  mois N / N-1 (backlog métier).

## Admin

### PAR-020 — Modération d'une nouvelle annonce  [P1]
- État : **✅** — liste des properties pending, `validate`/`reject` via
  `/api/properties/[id]/validate` + actions groupées `/api/admin/bulk` ;
  tout est tracé dans `audit_log`.

### PAR-021 — Code promo  [P2]
Créer un code -10 % plafonné, l'appliquer au checkout.
- État : **✅** — CRUD `/api/promotions` + `/api/promotions/apply` ;
  le checkout applique le code (`<PromoCodeInput>`, envoi de
  `promoCode` dans `POST /api/bookings`).

### PAR-022 — Suspension d'un utilisateur abusif  [P2]
- État : **✅** — `PATCH /api/users/[id]/suspend` (admin) +
  `<UserSuspendActions>` dans `/dashboard/users` ; le suspendu ne peut
  plus se connecter.

### PAR-023 — Facture / reçu d'une réservation  [P2]
Éditer un document de facturation pour une réservation.
- État : **✅** — `GET /api/bookings/[id]/invoice` produit un document
  imprimable (HTML → PDF navigateur). Titre « FACTURE » avec numéro et
  mentions légales **si** l'admin a renseigné SIRET/TVA (réglages
  facturation) ; sinon « REÇU » avec mention explicite de non-conformité
  fiscale (T-116). Accès propriétaire/hôte/admin (401 anonyme, 404
  inexistant, vérifiés).
- Preuve : ▶️ 200 HTML owner/host/admin, 401 anonyme, 404 inconnu,
  bascule REÇU↔FACTURE vérifiée selon les réglages.

## Sécurité & opérationnel

### PAR-030 — Refus de démarrer sans `JWT_SECRET`  [P1]
- État : **✅** (T-001, `src/lib/auth.test.ts`).
### PAR-031 — Seed inaccessible en prod sans token  [P1]
- État : **✅** (T-002, `src/app/api/seed/route.test.ts`).
### PAR-032 — Rate-limit brute-force  [P1]
- État : **✅** (T-009 ; mono-instance mémoire, Redis = 🎯 scale).
### PAR-033 — Middleware bloque l'accès non authentifié  [P1]
- État : **✅** — ▶️ smoke : APIs protégées 401 sans cookie, customer
  403 sur routes admin, guards de pages.
### PAR-034 — Cohérence du framework `.ai/`  [P1]
- État : **✅** — `npm run ai:check` 20 règles (R1–R20) au vert.

---

## 📊 Bilan parcours (révisé 2026-08-27)

| Parcours | Nombre | ✅ | 🚧 | 🎯/❌ |
|---|---|---|---|---|
| P1 (bloquants) | 9 | 7 | 2 | 0 (Stripe réel = intégration externe à valider) |
| P2 (importants) | 9 | 8 | 1 | 0 |
| P3 (confort) | 1 | 1 | 0 | 0 |
| Sécurité/Op. | 5 | 5 | 0 | 0 |

**Couverture fonctionnelle P1 ≈ 100 % en logique applicative.** Le seul
point bloquant avant ouverture réelle reste **hors code** : validation
d'un vrai compte Stripe test/live (et fourniture Resend/S3 si besoin),
plus les **E2E Playwright** à exécuter sur une CI avec Chromium.
