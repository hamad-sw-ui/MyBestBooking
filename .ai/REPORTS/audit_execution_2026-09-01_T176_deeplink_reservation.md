# 🔍 Audit d'exécution — deep-links du tunnel de réservation (T-176)

- **Date** : 2026-09-01
- **Méthode** : exécution réelle (PostgreSQL embarqué + seed + dev :3000).
  Données « vivantes » créées pour tester à fond : séjour passé `completed`
  (MBB-2026-AUDIT1), avis client 9.0 réellement posté, réponse hôte,
  conversation client↔hôte, alerte prix, partage de favoris public, 17
  pages sondées sous 2 rôles.

## 1. Éprouvé sain cette passe (aucune correction requise)

| Scénario exécuté | Verdict |
|---|---|
| Avis client (notes + commentaires) → publication + badge « Avis publié » | ✅ 201 + onglets `mes-reservations` |
| Réponse hôte (2000 car.) → 403 pour un non-propriétaire → affichage public fiche | ✅ |
| Messagerie client↔hôte (2 messages persistés, ouverture de fil par résa) | ✅ 201×2 |
| Alertes prix : création UI contractuelle, 400 franc sur mauvais champ | ✅ |
| Partage de liste favoris : page publique accessible même anonyme | ✅ 200 |
| `/dashboard/settings` réservé admin (redirect /dashboard) ; nav propre | ✅ |
| Pagination hors bornes, états vides messagerie/réservations | ✅ |

## 2. Problème retenu — deep-link incomplet → impasse sans recours

| URL | Rendu avant T-176 |
|---|---|
| `/reservation?roomId=<room>` (ex. lien partagé, favori ancien) | « Informations de réservation manquantes » + impasse, alors que `GET /api/rooms/[id]` expose déjà la `propertyId` — information **déductible** |
| `/reservation?property=<p>` (sans chambre) | même impasse, alors que sa fiche publique liste toutes les chambres avec CTA complets |

**Cause racine** : `readReservationParams` exige property + room, et rien ne
proposait de rattrapage. Les liens complets générés par l'app sont sains ;
ce sont les liens **externes/partagés/incomplets** qui tombaient dans un
cul-de-sac.

## 3. Solution livrée (zéro régression par construction)

- **`src/lib/reservation-url.ts`** : nouvelle fonction pure
  `describeIncompleteLink()` → `roomOnly | propertyOnly | null`. Les liens
  complets, la reprise de paiement `?booking=` et les liens vides sont
  **strictement inchangés** (contract testé).
- **`reservation-form.tsx`** : effet de résolution —
  - `roomOnly` → `GET /api/rooms/[id]` → pré-remplit `propertyId` + `roomId`
    → le tunnel continue dans l'effet principal (chargement « normal ») ;
  - `propertyOnly` → `GET /api/properties/[id]` → `router.replace()` vers
    `/hebergement/[slug]` (choix de chambre au bon endroit) ;
  - échec 404 → état « informations manquantes » **inchangé** ;
  - pendant la résolution : pied « Chargement… » au lieu du faux message.
- **+5 tests unitaires** (`describeIncompleteLink`) — 450/450 au total.

## 4. Bornes de non-régression

Aucune requête modifiée ; le tunnel valide (property+room complets) passe
par le même chemin qu'avant (aucun appel ajouté — `describeIncompleteLink`
renvoie null immédiatement) ; la reprise de paiement `?booking=` n'est
jamais détournée ; l'état d'erreur pour lien mort est identique.
