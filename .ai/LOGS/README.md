# LOGS

Notes brutes de session — commandes lancées, sorties intéressantes,
raisonnements en cours. Idéal pour laisser une trace quand on interrompt un
travail au milieu.

**Facultatif** (les entrées formelles vont dans `PROGRESS.md`). Utile quand
on veut garder la trace complète d'une exploration sans polluer
`PROGRESS.md`.

## Nommage

`YYYY-MM-DD_<sujet>.md`.

## Contenu type

- Sortie de commandes (`ls`, `grep`, `curl`, `npm run typecheck`)
- Extraits de logs applicatifs
- Hypothèses en cours d'exploration (tag ❓)
- Décisions provisoires (à formaliser ensuite dans un ADR si structurant)

## Discipline

Un LOG **n'est pas une source de vérité**. Il documente le chemin, pas
la destination. Les conclusions doivent être **remontées** dans
`PROGRESS.md`, `BUGS.md`, `BACKLOG.md`, `STATE.md`, ou un rapport
`REPORTS/`.

Un LOG plus vieux que 90 jours **peut être supprimé** en rétrospective §17,
sauf s'il documente une décision référencée par un ADR ou un rapport.
