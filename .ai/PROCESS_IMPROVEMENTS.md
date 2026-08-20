# 🔄 AMÉLIORATION CONTINUE DU FRAMEWORK

Rétrospectives produites après chaque tâche (`CODING_RULES.md` §17).

> ⚖️ **Contrepoids permanent** : à chaque règle ajoutée, se demander laquelle
> peut être fusionnée, simplifiée ou supprimée. Un framework qui grossit sans
> cesse finit par être contourné — et un framework contourné ne protège plus rien.

---

## Rétrospective — 2026-07-28 · Phase 7 (conception, débat, opportunités)

### Qu'est-ce qui a bien fonctionné ?
- **Le débat multi-rôles a produit un défaut réel** que ni l'audit, ni l'analyse
  d'impact n'avaient vu : BUG-024 (fenêtre de concurrence pendant la
  restauration). Jouer sincèrement l'Expert Room a fait émerger une question que
  je ne m'étais pas posée en trois lectures du même fichier.
- **L'obligation de proposer trois solutions** a évité un biais réel : ma
  première intention était de brancher directement (solution B). La comparaison
  a montré qu'il fallait d'abord corriger les fondations (solution C).
- **Le rapport d'opportunités** a mis au jour 5 duplications de `ACTION_SEND` et
  deux implémentations concurrentes de l'export CSV — invisibles quand on
  regarde un seul fichier.

### Qu'est-ce qui a ralenti le développement ?
- **Rien n'a été codé cette session.** Quatre documents produits, zéro ligne de
  production. C'est justifié au niveau C, mais **ce rythme serait intenable**
  sur des modifications ordinaires — d'où la grille de proportionnalité §15.0,
  écrite en même temps que la règle qu'elle tempère.
- La rédaction du débat est coûteuse : ~40 min pour dix rôles argumentés.
  Rentable au niveau C, absurde en dessous.

### Quelles erreurs auraient pu être évitées ?
- 🔴 **J'ai inscrit dans le débat une objection fausse** : « le singleton
  `AppDatabase` n'est pas invalidé après restauration ». La vérification a montré
  que `getDatabase()` gère le cas (`AppDatabase.kt:138-142`). J'ai corrigé et
  **conservé la trace de l'erreur** plutôt que de la réécrire silencieusement.
  → **Enseignement** : un débat génère des *hypothèses*, jamais des *faits*.
  Toute objection technique doit être vérifiée avant d'entrer dans `BUGS.md`.
  C'est exactement ce que la règle §16 impose ; elle a fonctionné.

### Quelle nouvelle règle améliorerait le framework ?
**Proposition R1** — *« Toute objection émise en débat qui conduit à créer une
entrée dans `BUGS.md` doit être vérifiée dans le code, commande à l'appui, avant
inscription. »*

Cette règle n'est **pas** un ajout : c'est une application de §16 à un cas
particulier. Je propose de l'insérer comme une phrase dans §15.2 plutôt que
comme une règle nouvelle — conformément au contrepoids anti-inflation.

### Cette règle doit-elle devenir permanente ?
✅ Oui, **sous forme d'une phrase dans §15.2**, pas d'une section supplémentaire.

### Contrepoids — quelle règle peut être allégée ?
Les modèles `MODELE_rapport_analyse.md` et `MODELE_analyse_conception.md` se
recouvrent partiellement (constats, options, recommandation). **Proposition** :
réserver `MODELE_rapport_analyse` aux analyses *exploratoires* (« quel est
l'état de X ? ») et `MODELE_analyse_conception` aux décisions *d'implémentation*.
Documenté dans `REPORTS/README.md` plutôt que par la suppression d'un modèle.

---

## Suivi des propositions

| # | Date | Proposition | Statut |
|---|---|---|---|
| R1 | 2026-07-28 | Vérifier toute objection de débat avant inscription dans `BUGS.md` | ✅ intégrée à §15.2 |
| R2 | 2026-07-28 | Clarifier la frontière entre les deux modèles d'analyse | ⏳ proposée |
