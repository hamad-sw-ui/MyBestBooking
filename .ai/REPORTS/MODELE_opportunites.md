# 💡 MODÈLE — OPPORTUNITÉS D'AMÉLIORATION

> Copier en `opportunites_<AAAA-MM-JJ>_<composant>.md`.
>
> Produit lors de toute analyse d'impact de niveau **S** ou **C**
> (`CODING_RULES.md` §15.3).
>
> 🚫 **Ces opportunités ne sont jamais implémentées automatiquement.**
> Elles sont proposées, versées au backlog, et attendent un arbitrage explicite.

---

# Opportunités d'amélioration — <composant>

**Date** : AAAA-MM-JJ
**Composant analysé** : `<chemin>`
**Contexte** : analyse d'impact `analyse_impact_<date>_<sujet>.md`

---

## Synthèse

| Axe | Opportunités | Gain cumulé estimé |
|---|---|---|
| Simplification | | |
| Réduction du volume de code | | |
| Performances | | |
| Mémoire | | |
| Batterie | | |
| Lisibilité | | |
| Testabilité | | |
| Sécurité | | |
| Maintenabilité | | |
| Expérience utilisateur | | |
| Architecture | | |

**Total : N opportunités** — 🔴 N critiques · 🟠 N majeures · 🟡 N mineures

---

## Détail

### O-01 — <intitulé>

| Champ | Valeur |
|---|---|
| **Axe** | performances / sécurité / … |
| **Emplacement** | `fichier.kt:ligne` |
| **Constat** | 🔍 *observé* — description factuelle |
| **Proposition** | |
| **Gain estimé** | *quantifié quand c'est possible : « −120 lignes », « −1 requête par recomposition »* |
| **Coût** | Faible (< 1 h) · Moyen (une session) · Élevé (plusieurs sessions) |
| **Priorité** | 🔴 / 🟠 / 🟡 |
| **Risque** | Faible / Moyen / Élevé — *que casse-t-on en la mettant en œuvre ?* |
| **Dépendances** | *nécessite Hilt / la refonte des migrations / …* |
| **Backlog** | B-XXX *(si versée)* |

### O-02 — <intitulé>
*(même grille)*

---

## Opportunités écartées

| Opportunité | Motif de rejet |
|---|---|

> Documenter les rejets évite de réexaminer trois fois la même fausse bonne idée
> lors des sessions suivantes.

---

## Recommandation

**À verser au backlog** : O-xx, O-yy
**À traiter dans la tâche en cours** *(uniquement si indissociable)* : O-zz
**À écarter** : O-aa

> ⚠️ Mêler une amélioration facultative à un correctif dilue le périmètre et
> rend toute régression impossible à attribuer. En cas de doute : verser au
> backlog, ne pas traiter maintenant.

**Arbitrage attendu du responsable** : ☐ oui ☐ non
