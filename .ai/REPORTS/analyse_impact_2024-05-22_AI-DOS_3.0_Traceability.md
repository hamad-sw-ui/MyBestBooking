# Analyse d'Impact — Implémentation AI-DOS 3.0 (Traçabilité)

**Niveau : Critique (C)**
**Date :** 2024-05-22
**Sujet :** Mise en place de la matrice de traçabilité des preuves.

## 1. Analyse des dépendances
- **Fichiers directs :**
    - `.ai/framework.manifest.json` (Ajout de TRACEABILITY.md)
    - `.ai/INDEX.md` (Référencement)
    - `.ai/CODING_RULES.md` (Mise à jour des règles de validation §13)
    - `.ai/TRACEABILITY.md` (Nouveau document obligatoire)
- **Fichiers indirects :**
    - `STATE.md` : Doit rester cohérent avec la matrice.
    - `BUGS.md` : Les statuts VALIDÉ dépendent désormais de la chaîne complète de preuves.

## 2. Risques identifiés
- **Divergence documentaire :** Risque que `TRACEABILITY.md` ne soit pas mis à jour en même temps que `STATE.md`.
    - *Atténuation :* Règle de blocage stricte dans le framework.
- **Rétrocompatibilité :** Le passage de 2.2 à 3.0 doit conserver les preuves déjà obtenues pour le Jalon 3.
    - *Action :* Initialiser la matrice avec les preuves du Jalon 3 (65 tests, build SUCCESS).

## 3. Plan d'implémentation
1.  Création de `.ai/TRACEABILITY.md` avec la structure demandée.
2.  Peuplement initial avec les données du Jalon 3 (B-018 à B-023, B-094A).
3.  Mise à jour de `framework.manifest.json` (version 3.0.0).
4.  Mise à jour de `CODING_RULES.md` pour intégrer la chaîne de traçabilité.
5.  Mise à jour de `INDEX.md`.

## 4. Preuves à fournir
- [ ] Lecture réussie du manifeste mis à jour.
- [ ] Présence physique de `TRACEABILITY.md`.
- [ ] Rapport de conformité final.
