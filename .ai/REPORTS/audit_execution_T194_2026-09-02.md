# Rapport d'audit d'exécution — T-194 (accès démo un clic)

- **Date** : 2026-09-02
- **Demande** : « faites que les accès démo puissent passer correctement ».

## Diagnostic

- L'authentification des 3 comptes démo **fonctionnait déjà** (probe API :
  admin/host/customer → 200 « Connexion réussie »).
- Le bloc démo de `/connexion` était du **texte statique** : l'utilisateur
  devait copier-coller email + mot de passe. Les « accès démo » ne
  « passaient » donc pas **d'un point de vue utilisateur**.

## Conception

- Boutons **un clic** (variant `outline` du design system) qui pré-remplissent
  ET connectent via **la même fonction** `loginWith()` que le formulaire
  (mêmes invalidations T-173/T-174 mahmoud, même redirection dashboard/home,
  même gestion 2FA/erreur) — aucun chemin d'API spécial (la sécurité ne
  change pas : les identifiants étaient déjà affichés en clair).
- Sécurité inchangée : aucune route/serveur nouveau ; les comptes démo sont
  créés par `/api/seed` (protégé en prod, T-178) ; la preview garde ses
  comptes démo seed de façon idempotente.
- i18n : nouvelle clé `auth.demoHint` (fr/en) ; `demoAccounts` reformulée
  (« connexion en un clic » / « one-click sign-in »). Verrou de comptage
  du test ui-strings maintenu : **1421 → 1422** (commentaire T-194).
- Verrou runtime : les login API restent couverts par le smoke
  (`login × 3 rôles`) + **nouvelle assertion** « 3 boutons d'accès démo
  présents » (smoke 94 → **95**).

## Fichiers
- `src/app/(auth)/connexion/login-client.tsx` (refactor `loginWith` +
  `handleDemoLogin` + bloc démo en boutons)
- `src/lib/ui-strings.ts` (demoHint fr/en)
- `src/lib/ui-strings.test.ts` (verrou 1422)
- `scripts/smoke.sh` (+1 assertion, header `@assertions: 95`)
