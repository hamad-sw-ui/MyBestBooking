# Audit d'exécution — T-188 (images natives + cron dormant)

- **Date** : 2026-09-02

## Partie (a) — `<img>` natifs

**Avant** : 12 `<img>` natifs hors `next/image` (galerie fiche,
réservations, messages, tunnel, dashboards, avatar). Tous peuvent recevoir
des URLs **arbitraires** (hôtes/utilisateurs) → un remplacement aveugle par
`<Image>` aurait cassé toute image hors whitelist de domains.
**Après** : composant `SmartImage` (local → `next/image` optimisé ;
distant → `<img>` lazy/async enrichi, jamais cassé). Verdict runtime :
fiche entièrement servie via `/_next/image` (srcset responsive), pages
connectées idem ; `user-avatar` conserve `<img>` + `onError` volontairement
(fallback initiales, hors périmètre). 11 `<img>` migrés, 1 conservé par
design.

## Partie (b) — cron « dormant » (défaut trouvé)

- `POST /api/cron/price-alerts` → **405** (le handler est un GET).
- Sans `CRON_SECRET` (absent de la preview) : **401** — et même avec une
  planification `vercel.json`, **rien n'appelle la route hors Vercel** :
  alertes prix, clôture des séjours payés (cashback + parrainage), rappels
  et demandes d'avis étaient **dormants en preview**.

**Preuve d'exécution après fix** (runner local + secret) :
- `notified: 1` (alerte prix réelle, `last_notified_price=148.33`)
- `completedBookings: 1`, `loyaltyAwardedAt` posé, compteur 7→8
- `reviewRequestsSent: 1`, `alertEmailDelivery.sent: 1`
- 2ᵉ passage : tout à 0 → **idempotence confirmée** (`notified: 0`…).
- Cashback 0,00 € : règle documentée (5 % réservés aux Ambassador niveau 3
  au moment de la clôture — `loyalty.ts` ; customer niveau 2 → 0) : correct.

## BestRewards au checkout (exécution réelle)

Réservation villa BestRewards, customer niveau 2 : subtotal 945,00 →
**discount 176,72** → total 862,78, `confirmed`, paiement `succeeded` ✅.

## Interférences transitoires (documentées, non-retenues comme défauts)

Runs vitest « 2 échecs » quand le smoke/audit venait de muter la même base
juste avant ; isolés : **484/484** systématiques. Règle opérationnelle
consignée : suites lancées sur base stable (pas d'enchaînement smoke→vitest
dans le même souffle).

## Purge finale

Fixtures d'audit entièrement retirées (bookings CRON01/022HFT,
alerte prix, 6 mails, compteur BestRewards restauré à 7) : 0 artefact.
