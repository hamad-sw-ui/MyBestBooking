# Analyse d'impact — T-179 mode maintenance appliqué au proxy (pages)

- **Date** : 2026-09-01
- **Tâche** : T-179
- **Niveau** : S (réacheminement d'une garde existante ; API/gardes indemnes)

## Problème (prouvé à l'exécution)

Mode maintenance ON : `redirect()` dans `(main)/layout.tsx` avalé (page
servie 200) ; `/` hors groupe (main) jamais couverte. Détail :
`audit_execution_2026-09-01_T179_maintenance_pages.md`.

## Surface impactée

- `src/proxy.ts` : garde maintenance (whitelist déterministe, admin OK,
  erreur de sonde tolérée + loggée, redirection tracée).
- `src/proxy-maintenance.test.ts` (nouveau, 7 cas, mock de la sonde).
- `src/proxy.test.ts` : un seul ajout — mock `isMaintenanceActive()=false`
  pour isoler les cas historiques de l'état DB (sinon casse si la base
  partagée est en maintenance — démontré utile pendant le développement).
- `src/app/(main)/layout.tsx` : redirect conservé en filet (commentaire).

## Risques & garde-fous

- **Boucle de redirection** : `/maintenance` hors matcher → impossible
  (testé : page 200 pendant maintenance ON).
- **Lockout admin** : whitelist `/connexion` + `/api/auth/*` conservée ;
  admin connecté traverse (testé).
- **Propagation** : cache settings 60 s par bundle (API ≠ proxy) — passé
  60 s les deux convergent (mesuré). Documenté.
- **Perf** : une lecture settings (cache 60 s) uniquement pour les
  chemins non-whitelistés d'utilisateurs non-admin ; headers/pages
  inchangés hors maintenance (vitest historique + runtime sans mode).

## Preuves attendues

tsc · eslint · vitest complet (465) · build prod (60/60) · runtime prod
ON/OFF (admin traverse, anti-lockout, propagation TTL) · smoke 94/94 ·
ai:check.
