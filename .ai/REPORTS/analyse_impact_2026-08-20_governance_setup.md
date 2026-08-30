# Analyse d'impact — Mise en place du framework de gouvernance `.ai/` v1.0.0

- **Date** : 2026-08-20
- **Tâche** : T-000
- **Niveau** : S
- **Auteur** : Arena Agent Mode
- **Référence** : `CODING_RULES.md` §14 (9 questions)

---

## 1. Quoi

Ajout d'une **couche gouvernance** au-dessus du dossier `.ai/` existant :

- Nouveaux documents : `MISSION.md`, `INDEX.md`, `STATE.md`,
  `CURRENT_TASK.md`, `CODING_RULES.md`, `TRACEABILITY.md`, `TEST_PLAN.md`,
  `KNOWN_LIMITATIONS.md`, `PROCESS_IMPROVEMENTS.md`, `PROGRESS.md`,
  `framework.manifest.json`.
- Réécriture des checklists en mode **bloquant** (⛔) : `avant_commit.md`,
  `avant_pull_request.md`, `avant_release.md`, `CHECKLISTS/README.md`.
- Réécriture des prompts prescrits : `PROMPTS/session_start.md`,
  `PROMPTS/roles.md`, `PROMPTS/README.md`.
- Réécriture des READMEs de dossiers pour refléter le caractère
  obligatoire pour S/C : `ADR/README.md`, `REPORTS/README.md`,
  `LOGS/README.md`.
- Ajout de l'ADR fondateur `ADR/ADR-001_Framework_de_gouvernance.md`.
- Ajout des deux rapports fondateurs `REPORTS/analyse_impact_...` (ce
  document) et `REPORTS/analyse_conception_...`.
- Mise à jour du `README.md` racine de `.ai/` pour refléter le nouveau
  positionnement (framework, plus « aide-mémoire libre »).

**Aucune modification du code applicatif** (`src/`, `package.json`,
`next.config.ts`, `drizzle.config.json`, `eslint.config.mjs`).

## 2. Où

Chemin d'action : **`.ai/` uniquement**.

Arborescence après changement :

```
.ai/
├── framework.manifest.json          [NOUVEAU]
├── INDEX.md                          [NOUVEAU]
├── MISSION.md                        [NOUVEAU]
├── STATE.md                          [NOUVEAU]
├── CURRENT_TASK.md                   [NOUVEAU]
├── CODING_RULES.md                   [NOUVEAU]
├── TRACEABILITY.md                   [NOUVEAU]
├── TEST_PLAN.md                      [NOUVEAU]
├── KNOWN_LIMITATIONS.md              [NOUVEAU]
├── PROCESS_IMPROVEMENTS.md           [NOUVEAU]
├── PROGRESS.md                       [NOUVEAU]
├── README.md                         [MODIFIÉ]
├── PROJECT.md                        [inchangé]
├── ARCHITECTURE.md                   [inchangé]
├── DATABASE.md                       [inchangé]
├── API.md                            [inchangé]
├── UI.md                             [inchangé]
├── SECURITY.md                       [inchangé]
├── CODING_STYLE.md                   [inchangé]
├── DEV_ENVIRONMENT.md                [inchangé]
├── DEPENDENCIES.md                   [inchangé]
├── ROADMAP.md                        [inchangé]
├── BUGS.md                           [inchangé]
├── BACKLOG.md                        [inchangé]
├── DEVLOG.md                         [inchangé]
├── CHECKLISTS/
│   ├── README.md                     [MODIFIÉ - bloquant]
│   ├── avant_commit.md               [MODIFIÉ - bloquant]
│   ├── avant_pull_request.md         [MODIFIÉ - bloquant]
│   └── avant_release.md              [MODIFIÉ - bloquant]
├── PROMPTS/
│   ├── README.md                     [MODIFIÉ]
│   ├── session_start.md              [NOUVEAU, remplace demarrage.md]
│   ├── roles.md                      [NOUVEAU]
│   ├── nouvelle_fonctionnalite.md    [inchangé]
│   ├── correction_bug.md             [inchangé]
│   └── revue_de_code.md              [inchangé]
├── ADR/
│   ├── README.md                     [MODIFIÉ]
│   ├── TEMPLATE.md                   [MODIFIÉ]
│   └── ADR-001_Framework_de_gouvernance.md  [NOUVEAU]
├── REPORTS/
│   ├── README.md                     [MODIFIÉ]
│   ├── analyse_impact_2026-08-20_governance_setup.md  [NOUVEAU - ce fichier]
│   └── analyse_conception_2026-08-20_governance_setup.md  [NOUVEAU]
└── LOGS/
    └── README.md                     [MODIFIÉ]
```

## 3. Pourquoi

Le responsable a demandé (message du 2026-08-20) que `.ai/` devienne
« un framework de gouvernance aussi ». La version précédente, purement
aide-mémoire, ne suffisait pas pour un produit qui gérera à terme :

- des données personnelles (voyageurs),
- des transactions financières (bookings + paiement),
- un dashboard hôte avec commission calculée en base.

Un framework de gouvernance apporte :

1. **Traçabilité** — chaque changement laisse une piste auditable (§22).
2. **Honnêteté technique** — les tags §16 empêchent le faux « ça marche ».
3. **Non-régression** — la règle §13 empêche de clôturer sans preuve.
4. **Cohérence documentaire** — les §11 et checklists forcent la mise à
   jour de la doc en même temps que le code.

## 4. Appelants

`grep -rn "\.ai/" src` → aucun. Le code applicatif ne référence pas `.ai/`.

Appelants humains/agents de `.ai/` :

- **Toute future session d'agent** commence par `INDEX.md` (nouvelle
  contrainte). Prompt fourni : `PROMPTS/session_start.md`.
- **Le responsable** consulte `STATE.md`, `CURRENT_TASK.md`,
  `PROGRESS.md`, `TRACEABILITY.md`.
- **Les futures CI** (à ajouter) pourront lire `framework.manifest.json`
  pour vérifier la présence des documents obligatoires.

Rayon d'impact : **large côté processus, nul côté runtime**.

## 5. Contrat public

- Le contrat public de l'application (types exportés, routes API, schéma
  DB) **n'est pas modifié**.
- Le contrat public du framework `.ai/` (fichiers attendus, ordre de
  lecture, tags de preuve) **est nouveau** — il devient opposable dès ce
  commit.
- Compatibilité ascendante : aucun risque runtime. Risque processus :
  l'agent ou le développeur qui ignore le nouveau framework produira
  des artefacts refusables.

## 6. Migration

Aucune migration DB, aucun code à changer.

Migration **de processus** :

- Toutes les prochaines sessions doivent commencer par le prompt
  `PROMPTS/session_start.md`.
- Toute prochaine tâche doit être décrite dans `CURRENT_TASK.md` avant
  d'être exécutée.
- Les commits doivent respecter le format `<type>(<scope>): <résumé>`
  (déjà appliqué historiquement, mais désormais formalisé).

Pas de rotation de secret, pas d'invalidation de cache, pas de bump de
version applicative.

## 7. Sécurité

Impact sécurité **positif indirect** :

- La checklist `avant_release.md` **bloque un déploiement** si
  `JWT_SECRET` fallback n'a pas été retiré (BUG-001) et si `/api/seed` reste
  publique (BUG-002). Le framework rend explicitement visible ce qui était
  auparavant seulement dans `BUGS.md`.
- Le §14 point 7 (« Sécurité ») impose désormais une revue sécurité pour
  toute tâche S/C.

Aucune **nouvelle** surface d'attaque introduite (documentation pure).

## 8. Test

Comment vérifier que la mise en place fonctionne :

- **Test manuel n°1** — Vérifier la présence des documents obligatoires :
  ```bash
  jq -r '.mandatory_documents[]' .ai/framework.manifest.json \
    | while read f; do test -f ".ai/$f" && echo "OK $f" || echo "KO $f"; done
  ```
  Attendu : tous OK. (▶️ à exécuter en prochaine session)

- **Test manuel n°2** — Vérifier que le JSON du manifest est valide :
  ```bash
  jq . .ai/framework.manifest.json > /dev/null && echo OK
  ```
  Attendu : OK.

- **Test humain** — Demander à un agent fraîchement démarré d'appliquer
  `PROMPTS/session_start.md` et vérifier qu'il lit bien `STATE.md` en
  premier et qu'il refuse de coder sans `CURRENT_TASK.md` cohérent.

Comment vérifier que **rien n'a cassé** :

- Le code applicatif n'a pas été touché : `git diff --name-only main..HEAD -- src`
  ne retournera que des fichiers `.ai/…` — nul.
- `npm run typecheck` et `npm run build`, s'ils étaient exécutables,
  donneraient le même résultat qu'avant.

## 9. Rollback

- **Rollback immédiat** : `git revert <commit-sha>` — le dossier `.ai/`
  redevient l'état Session 1 (`4ad8884`) sans aucun effet sur le code.
- **Rollback partiel** : supprimer un document nouveau et retirer sa
  référence de `framework.manifest.json`. Aucun impact sur le code.
- **Rollback impossible** : n/a. Aucun changement destructif.

Aucun risque en prod car aucun runtime touché.

---

## Conclusion

Changement **à impact runtime nul, à impact processus fort**. Le principal
risque est la **discipline** : sans mécanisme automatisé, l'application du
framework repose sur la vigilance de chaque intervenant. Ce risque est
tracé dans `KNOWN_LIMITATIONS.md` et une amélioration est proposée dans
`PROCESS_IMPROVEMENTS.md` (script `check-ai.mjs`, hooks Git).
