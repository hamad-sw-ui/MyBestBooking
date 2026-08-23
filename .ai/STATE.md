# 🧠 ÉTAT DU PROJET (STATE)

## 📌 Identification

- **Projet** : MyBestBooking
- **Branche actuelle** : `arena/01a02dbb-mybestbooking`
- **HEAD audit addendum post-T-107** : `4b33b1a`
- **Version Framework** : AI-DOS 3.0.0
- **Dernière tâche validée** : T-107 — orchestration paiement, outbox et parcours opérationnels

## 🛠️ État technique

- Réservation : capacité, stock journalier, stop-sell, minStay, prix journalier,
  promo, wallet et snapshots sont contrôlés serveur sous verrou transactionnel.
  Le hold est committé avant tout appel PSP, possède un TTL et l’intent est
  idempotent/repris par le cron.
- Paiement : un webhook précoce reste en inbox. Un succès reçu après annulation
  ne confirme jamais le séjour : paiement/refund restent tracés et la
  compensation est rejouable avec une clé fournisseur stable.
- Avantages : la restauration promo/wallet des tentatives non payées est
  marquée `benefitsReleasedAt` afin d’être exactement une fois.
- Outbox : leases retryables, event key transmise au mailer/provider, message id
  fournisseur persisté. Les appels PSP/mailer sont hors transaction DB.
- Recherche/alertes : recherche countée et triée de manière stable; les alertes
  contextualisées évaluent les vraies règles de séjour, les autres restent
  explicitement des prix de base.
- Exploitation : calendrier hôte navigable par tranches de 90 jours, rate plans
  éditables sans toucher aux snapshots, bulk avis compatible votes, providers
  AES-GCM avec keyring de rotation contrôlé.

## ✅ Preuves du cycle T-107

- 🔨 `npx drizzle-kit migrate` : chaîne fraîche `0000…0013` appliquée ;
  colonnes et cascade votes contrôlées.
- 🔨 `npm run typecheck` et `npm run build` : succès.
- 🔨 `npm run lint` : 0 erreur, 16 warnings historiques non bloquants.
- 🧪 `npm test` : **218/218** réussis.
- ▶️ `npm run smoke` : **91/91** assertions.
- ▶️ Scénarios runtime : booking post-commit, webhook tardif refundé,
  outbox lease sans doublon, deletion review/vote, quote séjour 198,
  pagination hors bornes et PATCH rate plan.
- 🔨 `npm run ai:check` : 18 OK · 2 warn · 0 fail (avant synchronisation
  auto-référentielle du prochain HEAD).

## Limites résiduelles explicites

- La validation réelle Stripe, Resend et S3/R2 attend des credentials de test
  fournisseur; aucun succès externe n’est affirmé dans ce sandbox.
- Chromium Playwright ne peut pas être téléchargé ici : smoke HTTP/API, build
  et tests DB sont des preuves complémentaires, pas un E2E navigateur.
- Facture légale/payout, ticket support et réimport automatisé des anciennes
  pièces jointes restent hors périmètre; voir `KNOWN_LIMITATIONS.md`/backlog.
- Les audits profonds post-T-107 ont ouvert BUG-035 à BUG-038 : exposition de
  données publiques/modérées (dont le payload RSC recherche), annulations bulk
  financières/agrégats, 2FA/paramètres décoratifs et parcours invité/
  asynchrones/UI incomplets. Aucun déploiement production ne doit être envisagé
  avant T-108; voir les rapports `audit_execution_deep_post_T107` et addendum.

## Documents de référence

- `REPORTS/analyse_impact_2026-08-23_resilience_orchestrations.md`
- `REPORTS/analyse_conception_2026-08-23_resilience_orchestrations.md`
- `REPORTS/debat_technique_2026-08-23_resilience_orchestrations.md`
- `REPORTS/analyse_impact_post_2026-08-23_resilience_orchestrations.md`
- `REPORTS/validation_T-107_2026-08-23.md`
- `REPORTS/analyse_impact_2026-08-23_T108_frontieres_finance_2fa.md`
- `REPORTS/validation_T-108_2026-08-23.md`
- `REPORTS/audit_execution_deep_post_T107_2026-08-23.md`
- `REPORTS/audit_execution_addendum_post_T107_2026-08-23.md`
- `ADR/ADR-012_Orchestration_paiement_outbox_et_rotation.md`

---
*Mis à jour le 2026-08-23, T-107 validée; SHA à synchroniser après commit.*
