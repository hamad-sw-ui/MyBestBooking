# Analyse de conception — T-181…T-185 (accélération)

- **Date** : 2026-09-02

## Principes directeurs

1. **Mesurer d'abord** : chaque optimisation doit produire un chiffre
   avant/après ; ce qui ne gagne rien (mesuré) ne s'embarque pas
   (T-181 retire deux « optimisations » de pure forme).
2. **Ne jamais toucher au cœur temps réel** : disponibilité et réservation
   restent exactes ; seuls les contenus *publics et identiques pour tous*
   sont cachés (pattern déjà validé en prod : settings T-179).
3. **Réversibilité** : chaque changement tient en un fichier ou un bloc
   marqué T-18x ; le TTL borne par construction tout effet indésirable.

## Choix retenus

- **Cache de données** (`unstable`-like maison, module pur) plutôt que
  l'ISR de pages : le SSR dynamique est conservé (header personnalisé,
  locale, wallet bandeau…) → zéro risque de servir du HTML à la mauvaise
  personne.
- **Clé canonicalisée côté recherche** : ville normalisée (trim/lower)
  borne le cardinal ; bornes de prix **déjà converties EUR** dans la clé
  → la devise d'affichage ne fragmente pas le cache.
- **TTL 60 s** : cohérent avec le cache settings (inter-bundles Turbopack,
  leçon T-179) — la fraîcheur maximale de divergence est la même que celle
  déjà acceptée pour le mode maintenance.
- **Parallélisation plutôt que streaming** (T-184) : Suspense cassait la
  stabilité visuelle des pages ; ici le rendu est strictement identique,
  seul le temps de réponse baisse.
- **`npm run perf`** : la mesure devient un outil du repo, rejouable dans
  chaque future validation.

## Ce qui a été refusé (et pourquoi)

- Optimizer `/_next/image` : sandbox sans egress Unsplash → régression
  totale des visuels en preview. La config reste prête (remotePatterns)
  pour une prod avec accès sortant, ou après migration des visuels en
  uploads locaux.
- `optimizePackageImports` : 0 octet mesuré (Turbopack tree-shake déjà).

## Limites connues

- Caches process-local (mono-instance) — cf. KNOWN_LIMITATIONS.
- Fraîcheur catalogue/fiche ≤ 60 s après une écriture (ex. validation d'un
  hébergement).
