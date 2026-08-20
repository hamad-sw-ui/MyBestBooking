# 📓 LOGS

Journaux bruts de session : décisions prises, commandes exécutées, pistes
explorées puis abandonnées.

## Différence avec `PROGRESS.md`

| `PROGRESS.md` | `LOGS/` |
|---|---|
| Synthèse formelle, 6 rubriques imposées | Journal détaillé, format libre |
| Ce qui a été livré | Comment on y est arrivé |
| Lu à chaque session | Consulté seulement en cas d'enquête |
| Une entrée par session | Un fichier par session |

## Convention de nommage

```
AAAA-MM-JJ_session.md
AAAA-MM-JJ_session-2.md   # si plusieurs sessions le même jour
```

## À consigner

- Commandes exécutées et leur résultat (surtout les échecs)
- Hypothèses testées et invalidées — **précieux** : évite de refaire deux fois
  la même impasse
- Décisions techniques et leur justification
- Questions restées sans réponse
- Extraits de code ou de logs pertinents

## À ne pas consigner

- Secrets, clés, PIN, contenus de SMS réels
- Volumes bruts de sortie de commande (résumer)

## Sessions

| Date | Fichier | Objet |
|---|---|---|
| 2026-07-28 | `2026-07-28_session.md` | Audit initial + création du framework `.ai/` |
| 2026-07-28 | `2026-07-28_session-2.md` | Vérification des correctifs de sécurité + décisions D1–D4 |
| 2026-07-28 | `2026-07-28_session-3.md` | Phase 6 — environnement Docker |
