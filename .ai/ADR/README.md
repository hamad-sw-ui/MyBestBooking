# ADR — Architecture Decision Records

**Obligatoire pour tout changement de niveau S ou C** (`CODING_RULES.md`
§15.0, §11). Facultatif pour L (souhaitable si la décision aura un impact
au-delà d'une seule session). Interdit pour T (pas de valeur).

## Convention

- Nommage : `ADR-NNN_<titre_court>.md` (numérotation continue, jamais
  réutilisée).
- Statut : `proposé` → `accepté` → éventuellement `remplacé par ADR-XXX`
  ou `abandonné`.
- Un ADR est **immuable** une fois accepté. Pour le corriger, on ouvre un
  nouvel ADR qui le remplace explicitement.
- Un ADR référence les tâches (`B-xxx`) et bugs (`B-xxx`) concernés.

## Liste

| N° | Titre | Statut | Tâche | Date |
|---|---|---|---|---|
| 001 | Framework de gouvernance `.ai/` v1.0.0 | accepté | T-000 | 2026-08-20 |
| 009 | Intégrité réservation, paiement et cycle de vie | accepté | T-102 | 2026-08-23 |
| 010 | Coffre chiffré de configuration providers | accepté | T-103 | 2026-08-23 |
| 011 | Post-actions financières, fichiers privés et rate plans | accepté | T-104 | 2026-08-23 |

## Modèle

Voir [`TEMPLATE.md`](TEMPLATE.md). À copier au moment de créer un nouvel ADR.

## Discipline

Un changement structurant qui **contredit** un ADR accepté sans en produire
un nouveau qui le remplace est **refusé** par le responsable. Cette règle
existe pour éviter la dérive silencieuse d'une décision architecturale.
