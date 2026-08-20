# ✅ CHECKLIST — AVANT COMMIT

À dérouler **intégralement** avant tout `git commit`.
Une case non cochable = on ne committe pas, ou on documente pourquoi.

---

## 0. ☐ Environnement Docker validé  *(Phase 6 — préalable obligatoire)*

```bash
make verify
```

- [ ] `verify-env.sh` se termine par « Environnement validé »
- [ ] `.ai/REPORTS/rapport_environnement_*.md` produit

⛔ Si l'environnement est invalide : **ne pas modifier le code**.

## 0bis. ☐ Analyse d'impact réalisée  *(CODING_RULES §14)*

- [ ] `.ai/REPORTS/analyse_impact_<date>_<sujet>.md` existe **et est antérieur au code**
- [ ] Les 9 questions obligatoires sont renseignées, commandes à l'appui
- [ ] Les Workers/Services ont été explicitement examinés
- [ ] La liste de revérification (§9) est établie
- [ ] Correction importante → `analyse_impact_post_<date>_<sujet>.md` produit

⬜ Exemption : faute de frappe, commentaire, documentation seule (§14.5).

## 1. ☐ Compile  *(dans Docker)*

```bash
make build          # ou : ./docker/scripts/build.sh debug
```

- [ ] La compilation réussit **dans le conteneur**
- [ ] Le module `:app` est bien construit
- [ ] KSP a généré les classes Room sans erreur
- [ ] `.ai/REPORTS/rapport_compilation_*.md` produit

⚠️ **Environnement de l'agent** : ni Docker, ni JDK, ni SDK Android.
Si la compilation n'a pas pu être exécutée, l'écrire **explicitement** dans
`PROGRESS.md` (« non compilé — vérification statique uniquement »).
**Ne jamais affirmer qu'un code compile sans l'avoir prouvé.**

## 2. ☐ Aucun warning critique  *(dans Docker)*

```bash
make lint           # Android Lint + ktlint + detekt
```

- [ ] `.ai/REPORTS/rapport_avertissements_*.md` et `rapport_qualite_*.md` produits

- [ ] Aucun warning Kotlin nouveau introduit par le diff
- [ ] Aucune erreur Android Lint de sévérité `Error`
- [ ] Aucun avertissement de dépréciation sur une API de sécurité ou de base
- [ ] Aucun warning Room (schéma, index de clé étrangère manquant, requête ambiguë)

## 3. ☐ Tests réussis

```bash
make test           # unitaires — DANS Docker
make instrumented   # instrumentés — HORS Docker, appareil requis (§7)
```

- [ ] `.ai/REPORTS/rapport_tests_*.md` et `rapport_couverture_*.md` produits

- [ ] Tous les tests unitaires passent
- [ ] Les tests de migration passent (si le schéma a changé)
- [ ] Un test de non-régression a été ajouté pour tout bug corrigé
- [ ] Aucun test désactivé (`@Ignore`) sans justification écrite

## 4. ☐ Pas de fuite mémoire

Vérification par revue (pas d'outil automatisé dans le projet à ce jour) :

- [ ] Aucun `Context` d'Activity stocké dans un singleton, un repository ou un ViewModel
- [ ] Aucune référence à une Vue, une Activity ou un `NavController` dans un ViewModel
- [ ] Toute coroutine est lancée dans un scope à durée de vie maîtrisée
      (`viewModelScope`, `lifecycleScope`, `CoroutineWorker`)
- [ ] Aucun `CoroutineScope(...)` créé à la volée sans annulation
- [ ] `Cursor`, `BluetoothSocket`, `InputStream`/`OutputStream` fermés (`use { }`)
- [ ] Les collecteurs de `Flow` sont liés au cycle de vie
      (`collectAsStateWithLifecycle`)
- [ ] Aucun `remember` capturant une valeur non stable de longue durée

## 5. ☐ Pas de code mort

- [ ] Aucune fonction, classe ou import ajouté puis inutilisé
- [ ] Aucun code commenté laissé en place (Git est là pour l'historique)
- [ ] Aucun `TODO` sans référence au backlog (`// TODO(B-042): …`)
- [ ] Aucun fichier temporaire, de test manuel ou de brouillon
- [ ] Aucun `println` ni log de débogage oublié

```bash
git diff --cached | grep -nE "println|Log\.(d|v)\(|TODO|FIXME|XXX"
```

---

## 6. ☐ Contrôles transverses

- [ ] Aucun secret, clé, mot de passe ou numéro privé dans le diff
- [ ] Aucun fichier d'IDE (`.idea/`, `.kotlin/`) ni artefact de build indexé
- [ ] Aucun texte utilisateur codé en dur dans du code neuf
- [ ] Le diff est minimal (pas de reformatage parasite)

```bash
git status
git diff --cached --stat
```

## 7. ☐ Documentation

- [ ] `.ai/PROGRESS.md` — entrée du jour renseignée (6 rubriques)
- [ ] `.ai/BACKLOG.md` — tâches cochées `☑`, tableau de synthèse à jour
- [ ] `.ai/BUGS.md` — mis à jour si un bug est corrigé ou découvert
- [ ] `.ai/ARCHITECTURE.md` / `DATABASE.md` / `DEPENDENCIES.md` — mis à jour si
      la structure, le schéma ou les dépendances ont changé

## 8. ☐ Message de commit

Format : `<type>(<portée>): <description à l'impératif>`

```
fix(room): aligner la migration 24_25 sur SessionEntity
feat(staff): ajouter l'écran de gestion du personnel
docs(ai): mettre à jour ARCHITECTURE après l'introduction de Hilt
refactor(repository): extraire SalesRepository de MainRepository
test(sms): couvrir SmsParser sur les formats MTN et Orange
chore(build): déplacer sqlcipher vers le version catalog
```

- [ ] Le type est correct (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`)
- [ ] La description tient en une ligne et dit **quoi**, pas comment
- [ ] Le corps explique le **pourquoi** si ce n'est pas évident
- [ ] Le bug ou la tâche est référencé (`BUG-001`, `B-010`)

---

## 8bis. ☐ Chaîne de validation complète  *(Phase 6)*

```bash
make validate
```

- [ ] Verdict « ✅ VALIDATION RÉUSSIE » dans `.ai/REPORTS/rapport_validation_*.md`
- [ ] Aucune étape en échec

⛔ **Aucun code n'est « terminé » sans ce verdict.**

## 8ter. ☐ Statut des bugs conforme à la réalité  *(CODING_RULES §13)*

- [ ] Aucun bug marqué `CORRIGÉ (VALIDÉ)` sans compilation **et** tests réussis
- [ ] Les correctifs non exécutés sont marqués `CORRIGÉ (INSPECTION)`
- [ ] `PROGRESS.md` distingue « écrit » de « exécuté »
- [ ] Aucune formulation du type « ça compile » / « les tests passent » sans preuve
- [ ] Composant critique → **double validation** présente
      (harnais indépendant dans `tools/verification/` + tests Kotlin)

## 9. ☐ Branche

- [ ] Je suis bien sur `arena/019fa5ec-mobilecaisse`

```bash
git branch --show-current
```
