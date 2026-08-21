# ⛔ Checklist BLOQUANTE — avant d'ouvrir une PR

**Requise pour tout niveau S ou C.** Une PR qui skippe cette checklist
sans justification est refusée.

## Préambule

- [ ] La checklist `avant_commit.md` a été passée sur chaque commit de la PR
- [ ] `CURRENT_TASK.md` référence la tâche traitée par cette PR

## §13.2 — Build

- [ ] `npm run build` réussit localement (🔨)
- [ ] Aucun avertissement Next.js non trié (RSC/Client, `useSearchParams`,
  `dynamic route`)

## §13.4 — Tests

- [ ] Les tests existants passent (`npm test` — dès que J1 de `TEST_PLAN.md`
  est livré) (🧪)
- [ ] Un test **non-régression** existe pour tout bug corrigé
- [ ] Les nouveaux handlers d'API ont ≥ 1 test nominal + 1 test d'erreur

## §13.6 — Zéro régression

- [ ] Un scénario **manuel** couvrant les fonctionnalités adjacentes a été
  déroulé (▶️) — décrit dans la PR
- [ ] Captures d'écran si l'UI change

## §14 — Analyse d'impact préalable (S, C)

- [ ] `REPORTS/analyse_impact_<date>_<sujet>.md` existe et couvre les
  9 questions
- [ ] La liste des appelants (`grep -rn`) a été produite et vérifiée

## §15 — Conception et débat (S, C)

- [ ] `REPORTS/analyse_conception_<date>_<sujet>.md` existe (S, C)
- [ ] `REPORTS/debat_technique_<date>_<sujet>.md` existe si niveau **C**
  (ou S en cas de désaccord initial)
- [ ] ADR déposé dans `ADR/ADR-NNN_<titre>.md` si la décision est
  structurante et non triviale

## §13.5 — Double validation (C uniquement)

- [ ] Implémentation ET test automatisé indépendants — ni l'un ni l'autre
  n'a été dérivé du même raisonnement (🧪)

## Base de données

- [ ] Si le schéma a bougé → migration Drizzle générée
  (`npx drizzle-kit generate`) et commitée dans `drizzle/`
- [ ] La migration est **idempotente** ou clairement destructive et
  documentée
- [ ] Stratégie de **rollback** décrite dans la PR

## Sécurité

- [ ] Aucun secret n'a été introduit ; les env vars nouvelles sont
  documentées dans `DEV_ENVIRONMENT.md`
- [ ] Toute nouvelle route mute-ressource vérifie l'authentification **et**
  l'autorisation par rôle

## Description de PR

- [ ] Titre au format `<type>(<scope>): <résumé>`
- [ ] Corps : **contexte**, **ce qui change**, **ce qui reste ouvert**,
  **preuves d'exécution** (`npm run typecheck`/`build`/`test` OK,
  captures, sortie curl)
- [ ] Lien vers l'item du `BACKLOG.md` ou `BUGS.md` correspondant
- [ ] Cible : `main` — jamais une autre branche

## Traçabilité

- [ ] `TRACEABILITY.md` a une ligne pour l'item traité, avec au moins un
  tag §16 de preuve
- [ ] `PROGRESS.md` a une entrée de session à jour
- [ ] `STATE.md` reflète l'état après la PR

---

**Rappel §13** : tant que **tous** ces items ne sont pas cochés (ou
justifiés), l'item reste en `CORRIGÉ (INSPECTION)`. Marquer `VALIDÉ` avant
est une violation directe du framework.
