# 📓 Journal de développement

Notes libres, une entrée par intervention. Antéchronologique (la plus récente
en haut). Aucun format imposé — quelques lignes suffisent : ce qu'on a fait,
ce qu'on a appris, ce qu'on laisse pour la prochaine fois.

---

## 2026-09-07 — Versements : correctifs P6–P9 (UX/sémantique)

Suite au rapport `analyse_gaps_restants_P6P9_2026-09-07.md`, j'ai bouclé les
écarts **UX/sémantique** laissés par P1–P4 (qui étaient des régressions internes
déjà corrigées) :

- **P6** — le bouton `PayoutRequestButton` prend désormais `currency`
  (optionnelle) et le `POST /api/host/payouts` filtre par devise (`currency` dans
  le body Zod) → un clic sur la ligne EUR ne déclenche plus le XAF. Un `currency`
  sans payout correspondant → 404 (testé runtime).
- **P7** — garde-fou devise **visible** : le bouton consomme `skipped[]`
  (`payouts.skippedCurrency`) et `hasAccount===false` (`payouts.accountMissing`)
  au lieu d'un simple `reload()` silencieux.
- **P8** — la carte « Factures » (versements) pointe ses exports vers
  `/api/dashboard/billing/export-payouts`, **plus** vers `/export` (bookings,
  réservé à la carte Réservations).
- **P9** — nouvelle route `GET /api/dashboard/billing/export-payouts` : CSV du
  ledger `payouts` (période, devise, brut, commission, net, réservations,
  statut, versé le, idempotence), host/admin, 500 max, en-têtes `billingCsv.*`.

**Leçon** : sur une fonctionnalité déjà validée, les écarts peuvent être purement
« le serveur sait mais l'UI ne le montre pas ». La clé est de rebrancher l'état
(`skipped`, `hasAccount`, `currency`) du contrat existant dans l'UI — les ajouts
restent **additifs** (aucun paramètre requis), zéro régression.

Gates : tsc 0 · lint 0 · i18n 0 (catalogue **1462**) · vitest **536/536** ·
build 63 · ai:check 19 OK · 0 fail.

---

## 2026-08-20 — Réécriture complète de `.ai/`

**Contexte.** Le dossier `.ai/` initial décrivait un tout autre projet
(« MobileCaisse », app Android Kotlin de caisse enregistreuse) et imposait un
cadre de gouvernance lourd (Docker obligatoire, §13/§14/§15/§16/§17/§22,
rôles multiples, `blocking_rules`, double-validation, `CURRENT_TASK.md` unique
et bloquante…).

**Ce qu'on a fait.** Suppression intégrale de l'ancien contenu et création
d'un nouveau `.ai/` :

- Aligné sur **MyBestBooking** (Next.js + PostgreSQL + Drizzle).
- **Sans gate** : aucun document ne bloque un commit, une PR ou un
  déploiement. Les checklists sont fournies à titre d'aide-mémoire.
- Structure allégée : `README`, `PROJECT`, `ARCHITECTURE`, `DATABASE`, `API`,
  `UI`, `SECURITY`, `CODING_STYLE`, `DEV_ENVIRONMENT`, `DEPENDENCIES`,
  `BUGS`, `BACKLOG`, `ROADMAP`, `DEVLOG` + dossiers `PROMPTS/`,
  `CHECKLISTS/`, `ADR/`, `REPORTS/`, `LOGS/`.

**Pour la suite.** Voir `BACKLOG.md` — les items 🔴 sont les prérequis
sécurité/exploitation avant tout déploiement réel.
