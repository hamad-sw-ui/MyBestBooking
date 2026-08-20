# CHECKLISTS — bloquantes

⛔ **Ces checklists sont bloquantes.** Un item non coché **sans
justification écrite** (dans `PROGRESS.md` et/ou dans le message de commit)
empêche la clôture d'une tâche.

La checklist correspond au niveau de proportionnalité de la tâche :

- **T (trivial)** — aucune checklist requise, mention `[T]` en tête de
  commit.
- **L (local)** — `avant_commit.md`.
- **S (structurant)** — `avant_commit.md` + `avant_pull_request.md`.
- **C (critique)** — `avant_commit.md` + `avant_pull_request.md` +
  `avant_release.md` si le déploiement est imminent.

Ne cochez que ce que vous avez **réellement** fait. Le tag §16 associé est
imposé :

- ✅ = 🔨 / 🧪 / ▶️ (fait et prouvé)
- ⚠️ = 🧠 / ❓ (constaté sans preuve, à justifier)
- ⬜ = non fait

Un ✅ non prouvé est un mensonge — cf. `CODING_RULES.md` §16.

Documents :

- [`avant_commit.md`](avant_commit.md)
- [`avant_pull_request.md`](avant_pull_request.md)
- [`avant_release.md`](avant_release.md)

Ajouter une checklist supplémentaire (migration DB, rotation de secret,
etc.) suit la même règle : elle devient **bloquante** dès qu'elle est
publiée ici.
