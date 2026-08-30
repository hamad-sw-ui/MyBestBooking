# Analyse d'impact — T-003 : middleware d'auth (BUG-005)

- **Date** : 2026-08-20 · **Niveau** : S · **Tâche** : T-003 · **Réf** : §14

## 1. Quoi
Ajouter `src/middleware.ts` qui redirige vers `/connexion` les visiteurs
non authentifiés qui accèdent à `/mon-compte`, `/mes-reservations`,
`/mes-favoris`, `/messages`, `/reservation`, `/dashboard/*`.

## 2. Où
- Nouveau fichier `src/middleware.ts`.
- Aucun fichier existant modifié.

## 3. Pourquoi
Aujourd'hui seul `/dashboard/*` est protégé (via son `layout.tsx`). Les
autres routes voyageur nécessitant un compte affichent probablement des
pages vides ou plantent (ex: `/mes-reservations` fait `useEffect` sur
`/api/bookings` qui renvoie 401). UX dégradée et surface d'erreur pour
un attaquant qui tenterait de sonder les endpoints.

## 4. Appelants
`grep -rn "middleware" src` → aucun (le fichier n'existe pas).
Le middleware Next.js s'exécute avant chaque request qui matche son
`matcher`. Pas d'appelant à mettre à jour côté code.

## 5. Contrat public
Nouveau : les URLs protégées redirigent vers `/connexion?next=<url>`.
Ancien contrat (dashboard layout redirige aussi) : maintenu, double
sécurité acceptable.

## 6. Migration
Aucune. Prochain déploiement inclut le middleware.

## 7. Sécurité
- Vérification du cookie de session en edge (Next middleware = runtime
  edge par défaut).
- **Attention** : `bcrypt` et `pg` ne fonctionnent pas en edge. On ne
  peut donc pas appeler `getSession()` complet. On vérifie seulement
  la présence du cookie et la validité du JWT (jose fonctionne en edge).
- Une révocation en base ne sera détectée que par les handlers/RSC en
  aval, pas par le middleware. Acceptable — le middleware est une
  première barrière, pas la seule.

## 8. Test
- `src/middleware.test.ts` : vérifie que le middleware retourne un
  NextResponse.redirect pour un path protégé sans cookie, et
  NextResponse.next() sinon.
- Manuel : `curl -sI http://localhost:3000/mon-compte` sans cookie
  → 307 Location: /connexion?next=/mon-compte.

## 9. Rollback
`rm src/middleware.ts` et redéploiement. Pas de state à défaire.
