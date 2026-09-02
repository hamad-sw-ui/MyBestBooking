# Audit d'exécution — T-189 (hygiène hooks & directives eslint)

- **Date** : 2026-09-02
- **Périmètre** : `npx eslint src` complet — 11 warnings, 0 erreur.

## Inventaire (avant)

| Fichier:ligne | Warning | Cause réelle |
|---|---|---|
| `ui-locale-provider.tsx:29` | (cause racine, non listée) | `useT()` recréait `makeT()` à chaque render → `t` jamais inscriptible en deps |
| `dashboard/properties/[id]:112` | useEffect deps : `t` manquant | chargement initial / messages d'erreur |
| `settings-panel.tsx:686` | idem | chargement métadonnées providers |
| `price-alerts-section.tsx:78` | idem | chargement des alertes |
| `stripe-payment-form.tsx:72` | idem | chargement config Stripe |
| `rooms-manager.tsx:84` | useMemo deps : `roomTypeLabel` (fn locale recréée) | en plus : filtre `?q=` figé sur l'ancienne langue après bascule — **micro-bug i18n réel corrigé** |
| `promotions-manager.tsx:57` | `new Date()` à chaque render qui déstabilise le memo | filtre « active/expired » |
| `logger.ts`, `console-mailer.ts`, `logger.test.ts` | 5 directives eslint inutilisées | règles `no-console`/`no-unused-vars` non actives — directives aveugles |

## Résolution (sans changer de comportement)

1. **`useT()` stabilisé** (`useMemo(makeT, [locale])`) : la cause racine.
   Conséquence positive : un changement de langue re-déclenche désormais
   les effets dépendants (messages d'erreur localisés).
2. 5 effets → `t` ajouté aux deps (sûr : stable, pas de boucle).
3. `rooms-manager` : `roomTypeLabel` en `useCallback([t])` + ajouté aux
   deps → le filtre texte suit la langue.
4. `promotions-manager` : `now` mémoïsé au montage (panneau admin remonté
   à chaque navigation) + inscrit aux deps du memo.
5. 5 directives orphelines retirées.

## Preuve de non-régression

- eslint `src` : **0 erreur, 0 warning** (11 → 0).
- tsc 0 · vitest **484/484** (×2 isolés) · build 60/60 · smoke 94/94.
- Pages touchées probées : `/dashboard/properties/[id]` (hôte) 200,
  `/dashboard/settings` (admin) 200, `/mon-compte` 200, `/dashboard`
  200, version EN 200.
