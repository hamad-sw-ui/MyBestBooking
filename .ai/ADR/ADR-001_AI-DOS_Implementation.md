# ADR-001 : Implémentation du Framework AI-DOS

## Contexte
Le projet MobileCaisse est développé par différents agents IA de manière intermittente. La mémoire de conversation est volatile et limite la reprise de session efficace après une longue interruption.

## Problème
Comment garantir qu'un nouvel agent IA puisse reprendre le projet sans perte d'information, sans dépendre de l'historique de chat et en respectant scrupuleusement les règles établies ?

## Solutions envisagées
- **Solution A** : Continuer avec le framework .ai v1.0.0 (basé sur la confiance et la relecture manuelle).
- **Solution B** : Utiliser un système externe de gestion de projet (Jira/Trello).
- **Solution C** : Transformer le framework en un "AI Development Operating System" (AI-DOS) où l'état et la mémoire sont persistés directement dans le dépôt Git (STATE.md, DEVLOG.md, ADR/).

## Solution retenue
**Solution C : AI-DOS**.

## Arguments
- **Persistance** : L'état survit aux changements d'agents et aux limites de fenêtre de contexte.
- **Autonomie** : Le framework devient le "chef de projet", l'IA n'est que le moteur d'exécution.
- **Traçabilité** : Chaque décision est gravée dans le marbre (ADR) et chaque cycle est journalisé (DEVLOG).
- **Zéro-confiance** : Le système exige des preuves (compilation, tests) avant de valider un état.

## Conséquences
- Nécessite une rigueur accrue de l'agent pour mettre à jour STATE.md à chaque cycle.
- Légère augmentation du volume du dossier `.ai`.
- Garantie de continuité absolue pour le projet MobileCaisse.

## Date
2024-05-22

## Références
- Instruction "Évolution Finale du Framework – AI Development Operating System (AI-DOS)".
