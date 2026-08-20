# ✅ MODÈLE — ANALYSE D'IMPACT POST-CORRECTION

> Copier en `analyse_impact_post_<AAAA-MM-JJ>_<sujet>.md`.
>
> Obligatoire après chaque correction importante. Objectif : **confronter les
> conséquences réelles aux conséquences prévues** dans l'analyse d'impact
> préalable. Voir `CODING_RULES.md` §14.

---

# Analyse d'impact post-correction — <sujet>

**Date** : AAAA-MM-JJ
**Analyse préalable** : `analyse_impact_<date>_<sujet>.md`
**Réf.** : B-XXX / BUG-XXX
**Commit** : `<sha>`

---

## 1. Verdict global

| Question | Réponse |
|---|---|
| Les effets constatés correspondent-ils aux effets prévus ? | ☐ oui ☐ partiellement ☐ non |
| Des effets **non anticipés** sont-ils apparus ? | ☐ oui ☐ non |
| Une régression a-t-elle été détectée ? | ☐ oui ☐ non |
| Le correctif peut-il passer en `CORRIGÉ (VALIDÉ)` ? | ☐ oui ☐ non |

## 2. Prévu vs. constaté

### 2.1 Fichiers modifiés

| Fichier | Prévu ? | Écart | Explication |
|---|---|---|---|
| | ✅/❌ | | |

Tout fichier modifié **non prévu** doit être justifié : soit l'analyse était
incomplète, soit le périmètre a dérivé. Les deux méritent d'être dits.

```bash
git diff --stat <sha_avant>..<sha_après>
```

### 2.2 Composants impactés

| Composant | Impact prévu | Impact réel | Concordance |
|---|---|---|---|

### 2.3 Risques de régression

Reprendre le tableau §8 de l'analyse préalable :

| # | Risque anticipé | S'est-il matérialisé ? | Comment il a été traité |
|---|---|---|---|

### 2.4 Risques **non anticipés**

| # | Effet imprévu | Comment il a été découvert | Gravité | Traitement |
|---|---|---|---|---|

> Cette section est la plus instructive : elle mesure la qualité de l'analyse
> préalable. Une section vide est suspecte si le correctif était complexe.

## 3. Vérifications post-correction

Reprise de la liste §9 de l'analyse préalable :

- [ ] `<composant 1>` — résultat :
- [ ] `<composant 2>` — résultat :

## 4. Preuves de validation *(`CODING_RULES.md` §13)*

| Validation | Statut | Preuve |
|---|---|---|
| Environnement Docker | ☐ | `rapport_environnement_*.md` |
| Compilation réelle | ☐ | `rapport_compilation_*.md` |
| Tests unitaires | ☐ | `rapport_tests_*.md` — X/Y |
| Tests préexistants (non-régression) | ☐ | |
| Tests instrumentés *(si applicable)* | ☐ | `rapport_tests_instrumentes_*.md` |
| Validation indépendante *(composant critique)* | ☐ | `tools/verification/…` |
| Analyses statiques | ☐ | `rapport_qualite_*.md` |

## 5. Statuts mis à jour

| Bug / tâche | Avant | Après | Justification |
|---|---|---|---|

⚠️ Le passage en `CORRIGÉ (VALIDÉ)` exige **toutes** les cases de §4 cochées.

## 6. Dette introduite

| Dette | Motif | Échéance | Réf. backlog |
|---|---|---|---|

## 7. Enseignements pour les analyses futures

Ce que cette correction apprend sur la méthode elle-même :

- <ex. « les Workers avaient été oubliés dans l'analyse préalable : ajouter un
  contrôle systématique »>

Si un enseignement est généralisable, **mettre à jour le modèle d'analyse
d'impact** ou `CODING_RULES.md` en conséquence.
