# Analyse d'impact — T-188 (SmartImage + cron local)

- **Date** : 2026-09-02

## Changements

1. **`src/lib/local-image.ts`** (+5 tests) : règle pure « source
   auto-hébergée » (chemin `/…` non protocol-relative).
2. **`src/components/ui/smart-image.tsx`** : `<Image fill>` si local,
   `<img>` lazy/async sinon — sous-ensemble strict des props utilisées.
3. **11 `<img>` migrés** dans 9 fichiers (fiche ×2, réservations ×2,
   messages, tunnel, dashboards ×2, nouvelle propriété, bulk, profil) —
   conteneurs `relative` ajoutés là où `fill` l'exigeait.
   `user-avatar` **inchangé** (onError → initiales : cas légitime).
4. **`CRON_SECRET` ajouté à `.env.local`** (preview) — comportement par
   défaut du handler inchangé (**refus sans secret** conservé, sécurité).
5. **`scripts/cron-runner.mjs` + `npm run cron:local`** : ordonnanceur
   local (toutes les heures, un appel GET Bearer au handler idempotent) ;
   process de preview actif. **Aucun** handler ni route modifié.

## Impacts et maîtrise

| Surface | Impact | Maîtrise |
|---|---|---|
| Images distantes (hôtes/avatars) | Rendu identique (`<img>`), lazy en bonus | tests local-image + probes HTML |
| Images locales | optimisées `/_next/image` (srcset/w) | probes fiche : srcset complet servi |
| Layout | conteneurs `relative` ajoutés où requis | pages probées 200, smoke 94/94 |
| Cron | preview : désormais actif ; prod Vercel : inchangé | idempotence mesurée (2ᵉ tick = 0 effet) |
| Sécurité cron | secret exigé en production (inchangé), runner hors repo web | 401 sans Bearer conservé |
| eslint | warnings `no-img-element` résolus là où migré ; 1 warning préexistant (useEffect deps) conservé hors périmètre | diff-review |
