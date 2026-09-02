# Analyse de conception — T-176 rattrapage doux des deep-links réservation

- **Date** : 2026-09-01
- **Tâche** : T-176 (S)

## Alternatives envisagées

1. **Validation serveur + redirect HTTP 308** — rejeté : la page est un
   composant client (`ReservationView` sous Suspense) ; un redirect côté
   serveur exigerait de déplacer la lecture des paramètres, refonte plus
   risquée que nécessaire pour un cas marginal.
2. **Choix automatique de la « 1ʳᵉ chambre » pour `?property=…`** —
   rejeté : présomptueux (prix/capacité arbitraires) ; la fiche publique
   présente proprement le choix, avec dates/sélection en contexte.
3. **Rattrapage doux côté client** (retenu) : un effet borné, deux fetch
   existants (`/api/rooms/[id]`, `/api/properties/[id]`), pas de nouveau
   contrat, pas de redirection pour les liens complets — coût nul sur le
   chemin nominal.

## Design

- `describeIncompleteLink()` reste **purement structurelle** : elle décide
  *quoi tenter*, sans io. Couverture exhaustive : complet/null, booking,
  room (nouvelle + legacy), property (nouvelle + legacy), vide.
- Effet isolé, `cancelled` contre les états fantômes, fallback inchangé.
- Le texte « Chargement… » réutilise `reservation.loading` (pas de nouvelle
  clé, parité i18n maintenue à 1420).
- Le `router.replace` (pas `push`) évite une boucle avant/arrière.

## Non-régression

- Ordre de lecture des paramètres inchangé ; `readReservationParams` intact.
- La branche `error` (reprises de paiement en échec) conserve sa priorité
  d'affichage après résolution.
- Aucune pompe SSR ajoutée ; la page reste un client composant d'origine.
