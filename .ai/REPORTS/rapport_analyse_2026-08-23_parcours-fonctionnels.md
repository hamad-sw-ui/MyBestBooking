# Rapport d'analyse fonctionnelle - 2026-08-23

## Objet

Audit d'execution de MyBestBooking : pages publiques, authentification,
recherche, reservation, favoris, avis et dashboard.

Auteur : GitHub Copilot
Statut : corrections appliquees et validation partielle executee.
Tâche : T-101
Niveau : L

## Constats et corrections

### Authentification et securite

- Le `JWT_SECRET` est obligatoire dans `src/lib/auth.ts`.
- La duree standard de session reste de 7 jours.
- L'option `rememberMe` etend explicitement la session a 30 jours.
- La connexion gere le second facteur TOTP quand l'API renvoie
  `twoFactorRequired`.
- Une reservation invitee ne peut plus reutiliser automatiquement un email
  deja associe a un compte : l'API renvoie HTTP 409 et demande la connexion.

### Recherche et affichage

- Les filtres prix et dates du formulaire `/recherche` sont transmis et
  appliques.
- La disponibilite verifie les reservations qui se chevauchent et les dates
  `stopSell`.
- Les cartes de logements affichent le prix minimum reel des chambres actives,
  et non une valeur fixe.
- Le script de theme passe par `next/script` et le layout declare le scroll
  smooth attendu par Next.js.
- Le JSON-LD de la fiche logement ne contient plus d'attribut duplique.

### Favoris et avis

- Le bouton coeur ajoute un logement a la premiere liste existante ou cree
  automatiquement `Mes favoris`.
- Les doublons sont traites sans erreur visible bloquante.
- Le lien `mailto:` d'avis a ete remplace par
  `/mes-reservations/avis/[id]`.
- Le formulaire envoie la note et les commentaires a `/api/reviews` ; les
  controles serveur restent la source de verite pour proprietaire, statut
  `completed` et unicite de l'avis.

### Analytics

- Les reservations annulees sont exclues des periodes comparees.
- Le panier moyen est calcule sur les reservations payees.
- Le taux d'occupation utilise les chambres actives et leurs quantites,
  plutot que l'hypothese d'une chambre par propriete.

## Validations executees

- `npx tsc --noEmit` : OK apres regeneration du cache `.next`.
- ESLint cible : OK ; avertissements restants sur quelques `<img>` natifs.
- Test `src/lib/auth.test.ts` : 10/10 OK.
- Smoke Playwright `tests/e2e/smoke.spec.ts` : 6/6 OK.
- `npm run build` : OK, route d'avis incluse dans le build.
- `npm run ai:check` : 18 règles OK, 2 avertissements, 0 échec. Les alertes
  concernent uniquement les numéros partagés entre séries BUG/T et
  l'heuristique UI qui signale des boutons de présentation.

## Limites restantes

- Le paiement reel depend encore de credentials d'un fournisseur ; le mode
  mock ne doit pas etre presente comme paiement production.
- Le test bulk admin depend d'une API live sur `127.0.0.1:3000` et peut expirer
  quand aucun serveur n'est disponible ; ce n'est pas un timeout du handler.
- Le full Vitest peut depasser les timeouts avec plusieurs imports lourds et
  tests DB live ; les tests JWT passent isoles.
- Quelques pages utilisent encore `<img>` au lieu de `next/image`.
- La pagination complete des resultats avec filtres doit encore etre
  consolidee par une requete SQL avec comptage total.
- Le responsive du tableau dashboard peut encore etre ameliore par une vue
  cartes mobile.

## Regle de non-regression

Les changements ont conserve les contrats existants des routes API. Toute
extension future doit ajouter un test de forme de reponse, un test de permission
et un parcours navigateur pour les actions visibles.
