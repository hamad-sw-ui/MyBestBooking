# Analyse de conception — T-263 (B10) et T-264 (B12)

- **Date** : 2026-09-11 · **Tâches courantes** : T-263, T-264 · **Niveau** : S
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.10, § 3.12

## 1. B10 — « résidus de la sortie du paiement en ligne : à récapituler, pas à supprimer »

**Problème.** Cinq éléments de la sortie du paiement plateforme (T-207) subsistent dans le code sans
appelant d'interface : `POST /api/bookings/[id]/payment` (410), `GET /api/providers/stripe` (stub),
lecture de compatibilité `propertyId`/`roomId`, `GET /api/cron/payouts` (410) et
`/dashboard/rooms/[id]` (redirection). Sans récapitulatif, ils passent pour des oublis — et le
risque est de « nettoyer » des colonnes dont le tunnel manuel dépend encore.

**Options.**

| Option | Verdict |
|---|---|
| Supprimer routes et compatibilités | **Écartée** : casserait les vieux liens (410 explicite) et les favoris |
| Tout conserver sans documenter | **Écartée** : dette invisible, « nettoyage » hasardeux |
| Récapitulatif `KNOWN_LIMITATIONS.md` + marqueurs `// legacy:` | **Retenue** : la dette est explicite, chaque élément porte sa condition de retrait |

**Conception retenue.** L'entrée « Dette T-207 » liste chaque résidu, sa raison d'être et sa
condition de retrait (aucune circulation de lien legacy sur 30 jours, ou remplacement par une page
d'explication) ; `bookings.paymentMethodOffline` / `paymentIntentId` / `paymentExpiresAt` y sont
signalés comme **utilisés** (à ne pas nettoyer). Les deux sites de compatibilité portent un
commentaire `// legacy:` renvoyant à l'entrée.

## 2. B12 — « rate-limit en mémoire : limitation connue, à énoncer au déploiement »

**Problème.** Le limiteur (Map + fenêtre glissante) protège connexion, inscription, mot de passe,
tunnel de réservation… mais n'est pas distribué : sur N instances, la limite effective est divisée
par N. Le fichier et `KNOWN_LIMITATIONS.md` le disent, mais rien ne le rappelle **au déploiement**.

**Options.**

| Option | Verdict |
|---|---|
| Migrer vers Redis maintenant | **Écartée** : dépendance et configuration nouvelle, hors décision produit |
| Documenter seulement | **Retenue**, complétée par l'option proposée par l'audit |
| + avertissement **unique** au premier usage en production sans `REDIS_URL` | **Retenue** : un log, aucun impact runtime, la limite cesse d'être invisible |

**Conception retenue.** Checklist `docs/CI.md` (ligne rate-limit) + log unique dans
`rateLimit()`, gardé par un booléen de module, conditionné à `NODE_ENV === "production"` et à
l'absence de `REDIS_URL`. Le jour où un stockage partagé est configuré, l'avertissement disparaît
de lui-même ; le jour où Redis devient la seule implémentation, la ligne de checklist et ce log
seront retirés ensemble.

## 3. Dette restante (assumée)

- Les routes 410 et la lecture de compatibilité disparaîtront quand plus aucun lien legacy ne
  circule (métrique d'accès sur 30 jours) — décision produit, pas technique.
- Le limiteur reste en mémoire : le passage à Redis est une évolution, pas un correctif.
