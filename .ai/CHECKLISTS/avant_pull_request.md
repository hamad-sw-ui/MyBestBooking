# ✅ CHECKLIST — AVANT PULL REQUEST

Prérequis : `avant_commit.md` déroulée pour **chaque** commit de la branche,
et `make validate` conclu par « ✅ VALIDATION RÉUSSIE ».

## 0. ☐ Preuves de validation Docker  *(Phase 6)*

- [ ] `.ai/REPORTS/rapport_validation_*.md` — verdict positif, joint à la PR
- [ ] `.ai/REPORTS/rapport_compilation_*.md`
- [ ] `.ai/REPORTS/rapport_tests_*.md`
- [ ] `.ai/REPORTS/rapport_avertissements_*.md`
- [ ] `.ai/REPORTS/rapport_couverture_*.md`
- [ ] `.ai/REPORTS/rapport_qualite_*.md`
- [ ] Tests instrumentés exécutés sur appareil si le diff touche
      SQLCipher / Keystore / migrations → `rapport_tests_instrumentes_*.md`

---

## 1. ☐ Architecture respectée

- [ ] Les couches sont préservées : `UI → ViewModel → Repository → DAO → Room`
- [ ] Aucun accès à `AppDatabase`, au système de fichiers ou à un `Intent`
      depuis un Composable
- [ ] Aucun DAO appelé directement depuis un ViewModel
- [ ] Aucune logique métier ajoutée dans `MainActivity` ou `CaisseApplication`
- [ ] Aucun nouveau god-object : `MainRepository` (992 l.) et `MainViewModel`
      (586 l.) n'ont pas grossi — idéalement ils ont maigri
- [ ] Aucun fichier nouveau ne dépasse 400 lignes
- [ ] Le nommage suit les conventions de `CODING_RULES.md` §9
- [ ] Aucune duplication introduite (vérification par `grep` effectuée)
- [ ] `ARCHITECTURE.md` reflète la structure après la PR

```bash
# Aucun accès base depuis l'UI ?
grep -rn "AppDatabase\.\|getDatabasePath" app/src/main/java/com/reconsiliation/caisse/ui/

# Taille des fichiers touchés
git diff main --name-only -- '*.kt' | xargs wc -l | sort -n | tail
```

## 1bis. ☐ Analyses d'impact jointes

- [ ] Analyse d'impact **préalable** présente dans `.ai/REPORTS/`
- [ ] Analyse d'impact **post-correction** présente
- [ ] Les écarts prévu/constaté sont expliqués, pas dissimulés
- [ ] Tous les points de la liste de revérification sont traités

## 2. ☐ Documentation mise à jour

- [ ] `.ai/PROGRESS.md` — une entrée par session de la branche
- [ ] `.ai/BACKLOG.md` — tâches cochées, synthèse recalculée
- [ ] `.ai/CURRENT_TASK.md` — reflète l'état réel (tâche close ou suivante validée)
- [ ] `.ai/BUGS.md` — statuts à jour avec cause racine et test de non-régression
- [ ] `.ai/DATABASE.md` — si le schéma a évolué (entités, migrations, index)
- [ ] `.ai/DEPENDENCIES.md` — si une dépendance a été ajoutée, retirée ou mise à jour
- [ ] `.ai/API.md` — si une interface externe a changé (SMS, Bluetooth, licence)
- [ ] `.ai/SECURITY.md` — si la crypto, les permissions ou les accès ont changé
- [ ] `.ai/TEST_PLAN.md` — si de nouveaux tests ont été ajoutés
- [ ] KDoc présent sur les nouvelles fonctions publiques de repository et les
      algorithmes non évidents
- [ ] La description de la PR explique le **pourquoi**, pas seulement le quoi

## 3. ☐ Sécurité vérifiée

- [ ] Aucun secret, clé, sel ou numéro privé ajouté au code source
- [ ] Aucun PIN, `managerCode`, clé ou SMS complet écrit dans les logs
- [ ] Aucune donnée personnelle ne quitte l'appareil sans action explicite
      de l'utilisateur
- [ ] Aucun SQL construit par concaténation de chaînes
- [ ] Toute nouvelle permission est justifiée dans `SECURITY.md`
- [ ] Toute action sensible est tracée dans `action_logs`
- [ ] Le contrôle de rôle (MANAGER / STAFF) est appliqué aux nouveaux écrans sensibles
- [ ] Si la crypto ou le chiffrement de la base est touché :
      `REPORTS/rapport_securite_<date>.md` rédigé
- [ ] Les données existantes restent lisibles après la modification
      (compatibilité ascendante prouvée)

```bash
git diff main | grep -inE "secret|password|api[_-]?key|token|salt\s*=\s*\""
```

## 4. ☐ Performances vérifiées

- [ ] Aucune requête sur le thread principal
- [ ] Les nouvelles requêtes SQL sont indexées (pas de scan complet)
- [ ] Filtrage et agrégation faits en SQL, pas en Kotlin sur une liste complète
- [ ] Les listes utilisent `LazyColumn`/`LazyRow` avec `key`
- [ ] Aucun chargement non borné d'un historique (paginer ou filtrer)
- [ ] Recompositions maîtrisées : paramètres stables, état hissé correctement
- [ ] Comportement vérifié (ou raisonné) sur un volume réaliste à 2 ans
      (~50 000 ventes)
- [ ] Aucune régression sur le temps de démarrage (`SplashScreen` fait déjà un
      accès base bloquant)
- [ ] Impact sur la taille de l'APK évalué si une dépendance a été ajoutée

---

## 5. ☐ Non-régression fonctionnelle

Parcours à valider manuellement (aucun n'est couvert par des tests automatisés
à ce jour) :

- [ ] Démarrage : Splash → PIN → Accueil
- [ ] Nouvelle vente en espèces, avec impression du ticket
- [ ] Nouvelle vente MoMo avec réconciliation SMS
- [ ] Vente à crédit → dette client mise à jour
- [ ] Ajout et ajustement de stock
- [ ] Clôture de journée → ventes verrouillées
- [ ] Sauvegarde puis restauration
- [ ] Bascule de rôle STAFF ↔ MANAGER

## 6. ☐ Qualité de la PR

- [ ] Un seul sujet par PR (une tâche du backlog)
- [ ] Historique de commits lisible
- [ ] Aucun fichier indésirable (`.idea/`, `.kotlin/`, `build/`, `*.log`)
- [ ] La PR part bien de `arena/019fa5ec-mobilecaisse`
- [ ] Le titre référence la tâche (`B-010`) ou le bug (`BUG-001`)

## 7. ☐ Modèle de description de PR

```markdown
## Objectif
<pourquoi cette PR existe — réf. B-XXX / BUG-XXX>

## Modifications
- ...

## Impact sur les données
<aucun | migration n→n+1 testée | action utilisateur requise>

## Vérifications
- Compilation : ✅ / ❌ / non exécutée (motif)
- Tests unitaires : X passants
- Tests de migration : ✅ / n.a.
- Non-régression manuelle : <parcours vérifiés>

## Points d'attention pour le relecteur
- ...
```
