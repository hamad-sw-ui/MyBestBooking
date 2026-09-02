# Analyse de conception — T-188 (SmartImage + cron local)

- **Date** : 2026-09-02

## (a) Pourquoi `SmartImage` plutôt que « next/image partout »

`next/image` avec `remotePatterns` finis casse toute URL d'un domaine non
listé — or hôtes et utilisateurs peuvent référencer des images **n'importe
où**. La bonne frontière n'est donc pas « natif vs optimisé » mais
« auto-hébergé vs externe » :

```text
src commence par "/" (hors //)  →  next/image (fill, sizes)
sinon                           →  <img loading="lazy" decoding="async">
```

- Règle pure (`local-image.ts`) testable — incl. `data:`/`blob:`/`//`.
- `fill` exige `position: relative` sur le parent → ajouté aux
  conteneurs concernés (audit visuel de chaque emplacement).
- `user-avatar` reste natif : son `onError → initiales` est une
  fonctionnalité, pas un oubli (déplacer la logique coûterait plus de
  risque que le gain).

## (b) Pourquoi un runner externe plutôt que modifier le handler

Le handler T-102 est idempotent, protégé, complet (12 sous-tâches) — le
manque était l'**appelant**. Trois architectures possibles :
1. Cron interne Node dans le serveur Next (module-level `setInterval`) —
   rejeté : side-effect au import, implem fragilisée par les rebuilds/dupli
   de bundles Turbopack (leçon T-179 : chaque bundle a son module-level).
2. Endpoint public de déclenchement — rejeté : surface d'attaque.
3. **Runner externe idempotent-safe** (retenu) : process distinct, appel
   HTTP avec Bearer, handler inchangé. Le 2ᵉ tick mesuré à 0 effet prouve
   l'absence de double exécution le jour où Vercel ET le runner appellent.

## Prix d'entrée

- `CRON_SECRET` est exigé par design en production — fourni à la preview
  via `.env.local` (le refus sans secret reste testé).
- `scripts/cron-runner.mjs` : aucun package (dotenv lu à la main) pour
  rester runnable même avant `npm ci`.
