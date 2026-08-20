# ⛔ Checklist BLOQUANTE — avant un commit

**Un commit qui pousse un item sans le cocher, sans justification écrite,
enfreint `CODING_RULES.md` §13.**

Niveau minimum requis : **L** (les tâches T peuvent omettre cette
checklist si le message de commit commence par `[T]`).

## §13.1 — Typecheck

- [ ] `npm run typecheck` passe sans erreur (🔨)

## §13.3 — Lint

- [ ] `npm run lint` passe (🔨)
- [ ] Les warnings restants sont **acceptés explicitement** dans le message
  de commit

## Sécurité (§4)

- [ ] Aucun secret dans le diff (`.env`, clés API, tokens, mots de passe)
- [ ] Aucun `console.log` de données personnelles ou d'auth
- [ ] Aucun `any` non justifié ajouté
- [ ] Aucun `catch (e) {}` vide ajouté

## Cohérence documentaire (§11)

Si l'un des items ci-dessous est concerné, la doc **doit** être à jour dans
le **même commit** :

- [ ] `src/db/schema.ts` touché → `DATABASE.md` mis à jour
- [ ] Route `/api/*` ajoutée/modifiée/supprimée → `API.md` mis à jour
- [ ] Nouvel écran ou changement de layout → `UI.md` mis à jour
- [ ] Comportement de sécurité changé → `SECURITY.md` mis à jour
- [ ] Dépendance ajoutée/retirée → `DEPENDENCIES.md` mis à jour
- [ ] Bug rencontré au passage → `BUGS.md` mis à jour

## Traçabilité (§22)

- [ ] `STATE.md` reflète l'état après ce commit
- [ ] `TRACEABILITY.md` mis à jour si un item change de statut

## Format du commit

- [ ] Message au format `<type>(<scope>): <résumé impératif>`
- [ ] Types autorisés : `feat`, `fix`, `docs`, `refactor`, `chore`, `test`,
  `perf`, `sec`
- [ ] Corps du message explique **le pourquoi** (pas juste le quoi)
- [ ] Branche = `arena/01a01eee-mybestbooking` (§8)

---

**Justification d'un item non coché** : à inscrire en fin de message de
commit, format :

```
NOT-CHECKED §13.1 — typecheck impossible : node_modules absents dans le
sandbox. Voir PROGRESS.md → session du 2026-08-20.
```
