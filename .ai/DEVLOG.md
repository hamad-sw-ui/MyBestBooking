# 📓 Journal de développement

Notes libres, une entrée par intervention. Antéchronologique (la plus récente
en haut). Aucun format imposé — quelques lignes suffisent : ce qu'on a fait,
ce qu'on a appris, ce qu'on laisse pour la prochaine fois.

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
