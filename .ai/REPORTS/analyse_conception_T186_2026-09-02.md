# Analyse de conception — T-186 (visuels locaux + optimizer images)

- **Date** : 2026-09-02
- **Statut** : **EN COURS** (étape 1/3 livrée — activation de l'optimizer
  subordonnée à la génération complète des visuels ; quota 10 images/tour).

## Problème

Les visuels de démo pointaient vers Unsplash (distant) : (1) dépendance
réseau superflue ; (2) l'optimizer `/_next/image` (retaillage/WebP serveur)
ne peut pas fonctionner ici — le sandbox n'a **pas d'egress Unsplash**
(mesuré T-181) — donc les images restaient non optimisées.

## Conception retenue : bascule progressive, jamais de 404

`src/lib/seed-images.ts` — `seedImageUrl(key, legacyUrl)` :
- fichier `public/seed-images/<clé>.jpg` **présent** → chemin local ;
- absent → URL distante historique (comportement inchangé).

Le rollout est donc piloté uniquement par la présence des fichiers —
zéro risque de régression intermédiaire, aucune feature flag runtime.

## Plan en 3 étapes (quota génération = 10 images/tour)

| Étape | Contenu | État |
|---|---|---|
| 1 | `seed-images.ts` (+3 tests) ; seed/page/hero migrés avec fallback ; **10/23 visuels générés** (5 propriétés × 2) ; UPDATE ciblé des propriétés existantes (seed idempotent) | ✅ faite — gates verts (479 tests, smoke 94/94, probes 200) |
| 2 | Générer 10 visuels (dunes ×2, barcelona ×2, toscana ×2, dest paris/marrakech/barcelone/rome) | ⏳ prochain tour |
| 3 | Générer les 3 derniers (dest-tunis, placeholder-property, hero-home) → **activer `unoptimized:false`** → fallback carte = placeholder local → probes `/_next/image` 200 + gates complets + validation | ⏳ |

## Garde-fous

- L'optimizer reste **inactif** tant qu'une source `<Image>` peut être
  distante (cartes des 3 propriétés restantes, destinations, fallback).
- Les galeries de fiche utilisent des `<img>` natifs (jamais l'optimizer)
  : leur fallback Unsplash reste donc affichable côté navigateur.
- Tests de `seed-imageUrl` : local si présent / legacy sinon / isolation
  par clé (mock fs) — 3/3 ✅.

## Hors périmètre (rappel)

Remarque (b) « cache TTL sur d'autres listings » : **non implémentée** —
`npm run perf` ne montre aucun besoin mesuré supplémentaire (toutes les
p50 ≤ 20 ms) ; on n'ajoute pas de cache sans nécessité mesurée.
Remarque (c) « audit e-mails transactionnels » : audit réalisé en T-180
(reset mot de passe complet validé) ; un audit e-mails élargi reste une
tâche future si souhaitée.
