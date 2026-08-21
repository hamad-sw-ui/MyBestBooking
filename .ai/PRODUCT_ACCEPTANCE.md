# 📋 PRODUCT_ACCEPTANCE — parcours utilisateur critiques

> Chaque parcours PAR-xxx représente **un scénario réel** qu'un
> utilisateur veut accomplir. Un produit est acceptable en prod si
> **tous les parcours de niveau P1 sont ✅**.
>
> Vérifié à terme par une future règle R18 : chaque PAR-xxx doit
> avoir un test Playwright `tests/e2e/par-xxx-*.spec.ts` qui passe.

## Légende

- ✅ **livré + testé E2E** (Playwright passe)
- 🚧 **partiel** (précisé)
- 🎯 **PROMISED** (planifié)
- ❌ **absent**
- **P1** = bloquant pour ouvrir aux vrais utilisateurs
- **P2** = important pour l'usage quotidien
- **P3** = confort

---

## Voyageur

### PAR-001 — Réservation nominale complète  [P1]
**Scénario** : Un visiteur crée un compte, cherche à Paris,
choisit une chambre, réserve, **paie**, reçoit **un email de
confirmation**, retrouve sa réservation dans son espace.

- État : 🚧 (booking et compte OK, paiement mocké, email absent)
- Test E2E : ❌ à créer `tests/e2e/par-001-booking.spec.ts`
- Bloquant : T-013 (email), T-020 (paiement)

### PAR-002 — Recherche avancée par disponibilité  [P1]
**Scénario** : Un voyageur cherche pour des dates précises et
un nombre de voyageurs. Seules les properties/chambres réellement
disponibles pour ces dates apparaissent.

- État : ❌ (recherche n'utilise pas `room_availability`)
- Test E2E : ❌
- Bloquant : T-012 (disponibilité)

### PAR-003 — Mot de passe oublié  [P1]
**Scénario** : Un voyageur clique « mot de passe oublié »,
reçoit un email, définit un nouveau mdp, se reconnecte.

- État : ❌ (aucune route, aucune UI)
- Test E2E : ❌
- Bloquant : T-013

### PAR-004 — Annulation d'une réservation  [P2]
**Scénario** : Un voyageur annule sa réservation. Un frais
d'annulation est appliqué selon `cancellationPolicy`. Un email
d'annulation est envoyé.

- État : 🚧 (annulation gratuite sans frais, sans email)
- Test E2E : ❌
- Bloquant : T-015 (calcul frais), T-013 (email)

### PAR-005 — Wishlist partagée  [P3]
**Scénario** : Un voyageur crée une wishlist publique, envoie
le lien à un ami qui la consulte sans être connecté.

- État : 🚧 (`shareToken` généré, aucune route publique de lecture)
- Test E2E : ❌
- Bloquant : T-015

### PAR-006 — Messagerie voyageur→hôte  [P2]
**Scénario** : Après booking, le voyageur envoie un message
à l'hôte (question sur l'arrivée). L'hôte reçoit une
notification email et répond depuis son dashboard.

- État : ❌ (aucun endpoint POST message)
- Test E2E : ❌
- Bloquant : T-015 (endpoints), T-013 (notif email)

### PAR-007 — Avis vérifié après séjour  [P2]
**Scénario** : Après check-out, le voyageur reçoit un email
l'invitant à noter le séjour. Il note et l'avis apparaît sur
la fiche property.

- État : 🚧 (POST /api/reviews OK, aucun mail d'invitation)
- Test E2E : ❌
- Bloquant : T-013 (email invitation), T-015 (modération admin
  si nécessaire)

### PAR-008 — Navigation clavier + lecteur d'écran  [P2]
**Scénario a11y** : Un utilisateur navigue toute la home au
clavier (Tab, Enter, Esc), toutes les images ont un `alt`, tous
les boutons icône-seul ont un `aria-label`.

- État : ❌ (35 boutons sans aria-label, pas de skip-links)
- Test E2E : ❌
- Bloquant : T-017 (a11y sweep)

## Hébergeur

### PAR-010 — Publication d'une annonce complète  [P1]
**Scénario** : Un hôte crée une property, **uploade 5 photos**,
crée 2 chambres, définit prix, publie. L'admin valide,
l'annonce devient visible dans la recherche.

- État : 🚧 (formulaire property OK sauf photos ; workflow
  validation absent)
- Test E2E : ❌
- Bloquant : T-014 (upload), T-015 (validation admin)

### PAR-011 — Ajustement du calendrier prix/stock  [P1]
**Scénario** : Un hôte ouvre le calendrier de sa chambre,
change le prix pour la haute saison, met un stop-sell sur
2 jours de maintenance.

- État : ❌ (aucun endpoint, aucune UI)
- Test E2E : ❌
- Bloquant : T-018

### PAR-012 — Réponse à un avis  [P2]
**Scénario** : Un hôte lit un avis 6/10, clique « Répondre »,
saisit sa réponse. La réponse apparaît sous l'avis pour tous
les voyageurs.

- État : ❌ (bouton présent, aucun endpoint)
- Test E2E : ❌
- Bloquant : T-015

### PAR-013 — Vue analytique mensuelle  [P2]
**Scénario** : Un hôte voit son CA du mois, sa commission,
son taux d'occupation, l'écart vs mois précédent.

- État : 🚧 (revenus + bookings 30j, pas d'occupation ni compare)
- Test E2E : ❌
- Bloquant : backlog analytics

## Admin

### PAR-020 — Modération d'une nouvelle annonce  [P1]
**Scénario** : L'admin voit la liste des properties en `pending`,
en ouvre une, vérifie, valide. La property passe en `active`.

- État : ❌
- Test E2E : ❌
- Bloquant : T-015

### PAR-021 — Création d'un code promo  [P2]
**Scénario** : L'admin crée un code `SUMMER2026` -10 % max
50 €, valide juin-août. Un voyageur l'applique au checkout,
la remise apparaît, la commission est ajustée.

- État : ❌ (aucun endpoint promo, pas d'application au booking)
- Test E2E : ❌
- Bloquant : T-015 (CRUD), T-015 (apply)

### PAR-022 — Suspension d'un utilisateur abusif  [P2]
**Scénario** : L'admin marque un utilisateur `deleted`. Il ne
peut plus se connecter.

- État : ❌ (soft delete existe, aucun endpoint)
- Test E2E : ❌
- Bloquant : T-015

## Sécurité & opérationnel

### PAR-030 — Serveur refuse de démarrer sans `JWT_SECRET`  [P1]
- État : ✅ (T-001, testé par `src/lib/auth.test.ts`)
- Test E2E : ✅ (unitaire, pas Playwright)

### PAR-031 — Seed inaccessible en production sans token  [P1]
- État : ✅ (T-002, testé par `src/app/api/seed/route.test.ts`)
- Test E2E : ✅ (unitaire)

### PAR-032 — Rate-limit brute-force  [P1]
- État : ✅ (T-009, testé + preuve manuelle ▶️)
- Test E2E : ✅ (unitaire)

### PAR-033 — Middleware bloque accès non authentifié  [P1]
- État : ✅ (T-003, testé)
- Test E2E : ✅ (unitaire)

---

## 📊 Bilan parcours

| Parcours | Nombre | ✅ | 🚧 | 🎯/❌ |
|---|---|---|---|---|
| P1 (bloquants) | 10 | 4 | 3 | 3 |
| P2 (importants) | 9 | 0 | 2 | 7 |
| P3 (confort) | 1 | 0 | 1 | 0 |
| **Total** | **20** | **4** | **6** | **10** |

**Couverture P1 = 40 %**, insuffisant pour ouvrir aux vrais utilisateurs.
Objectif Session 5+ : atteindre 100 % P1 via T-012 à T-020.
