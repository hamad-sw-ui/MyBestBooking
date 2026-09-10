# Analyse de conception T-210 — Simplification accueil et audit runtime

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Niveau** : S
- **Auteur** : Agent Arena.ai

## 1. Objectif

Simplifier le formulaire hero de la page d'accueil pour qu'il soit une entrée rapide vers le catalogue : destination + bouton rechercher uniquement. Les dates et le nombre de voyageurs restent disponibles là où ils sont utiles à la décision et à la disponibilité réelle : `/recherche`, fiche hébergement et tunnel `/reservation`.

## 2. Problème actuel

Le formulaire d'accueil demandait déjà :

- destination ;
- date d'arrivée ;
- date de départ ;
- nombre de voyageurs.

Ce choix est trop lourd pour un écran d'accueil : il force une précision prématurée, duplique le formulaire avancé de `/recherche` et rend l'entrée marketing plus frictionnelle. En revanche, retirer ces champs partout serait une régression car les dates/voyageurs sont indispensables au calcul de disponibilité, de capacité et de devis dans les pages aval.

## 3. Solutions possibles

### Option A — Ne rien changer

- **Avantages** : zéro diff, aucun risque technique.
- **Inconvénients** : ne répond pas à la demande utilisateur ; conserve la friction et la duplication.
- **Complexité** : nulle.
- **Performance** : inchangée.
- **Sécurité** : inchangée.
- **Maintenabilité** : inchangée mais UX moins claire.
- **Impact architecture** : nul.

### Option B — Retirer dates/voyageurs uniquement de l'accueil

- **Avantages** : répond exactement à la demande ; changement local ; aucun impact API/DB ; préserve `/recherche` et le tunnel.
- **Inconvénients** : l'utilisateur devra affiner dates/voyageurs à l'étape suivante s'il veut une disponibilité immédiate.
- **Complexité** : faible.
- **Performance** : très légèrement meilleure côté HTML initial.
- **Sécurité** : inchangée.
- **Maintenabilité** : meilleure séparation entre entrée rapide et filtres avancés.
- **Impact architecture** : aucun changement de contrat métier.

### Option C — Remplacer par un composant de recherche partagé configurable

- **Avantages** : évite la duplication future entre accueil et recherche.
- **Inconvénients** : refactor plus large, risque sur `/recherche`, délai supérieur à la demande actuelle.
- **Complexité** : moyenne.
- **Performance** : dépend du composant client/serveur choisi.
- **Sécurité** : inchangée si bien isolé.
- **Maintenabilité** : potentiellement meilleure mais plus risquée maintenant.
- **Impact architecture** : introduction d'une abstraction UI transverse.

## 4. Solution retenue

Option B : suppression locale des champs `checkIn`, `checkOut` et `guests` dans `src/app/page.tsx`, sans toucher à `/recherche`, `PropertyBookingCard`, `/reservation`, ni aux API.

Raison : c'est le plus petit changement répondant à la demande, avec le meilleur profil anti-régression.

## 5. Risques

| Risque | Niveau | Maîtrise |
|---|---|---|
| `/recherche` perdrait accidentellement ses filtres avancés | Moyen | Ne pas modifier ce fichier ; probe HTTP après build. |
| Les tests existants chercheraient les anciens champs sur `/` | Faible | Aucun contrat produit ne doit dépendre de ces champs ; ajout d'un test inverse. |
| Confusion utilisateur si `/recherche` s'ouvre sans dates | Faible | `/recherche` affiche déjà le formulaire avancé complet et accepte une destination seule. |
| Régression paiement T-207 | Élevé si touché | Aucun fichier paiement n'est modifié ; smoke/sims conservent les garde-fous. |

## 6. Compatibilité

- **Rétrocompatibilité URL** : `/recherche?city=Paris` inchangé ; `/recherche` accepte toujours les anciennes query strings `checkIn/checkOut/guests` venant d'ailleurs.
- **Données** : aucune migration, aucune mutation DB.
- **Utilisateurs** : l'accueil est plus simple ; les utilisateurs avancés retrouvent les filtres dès `/recherche`.
- **Performance** : HTML d'accueil un peu plus léger ; pas de changement côté requêtes.
- **Sécurité/finance** : T-207 inchangé, aucun paiement plateforme voyageur.

## 7. Plan de développement

1. Modifier `src/app/page.tsx` pour ne garder que `city` + CTA.
2. Ajouter un test source ciblé `src/app/page.home-filter.test.ts`.
3. Vérifier par test ciblé, typecheck, lint, i18n, Vitest global.
4. Vérifier par build + HTTP smoke/simulations/site-audit.
5. Produire rapport d'audit + validation + traçabilité `.ai`.

## 8. Plan de retour arrière

Retour arrière précis si la simplification est rejetée :

1. Restaurer dans `src/app/page.tsx` les deux inputs date et le select voyageurs du formulaire hero.
2. Retirer ou inverser `src/app/page.home-filter.test.ts`.
3. Relancer `npm run test -- src/app/page.home-filter.test.ts`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run smoke`.

Aucune donnée ni migration ne serait à restaurer.
