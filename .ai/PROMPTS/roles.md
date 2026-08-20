# 🎭 RÔLES SPÉCIALISÉS

Pour **chaque décision technique importante**, raisonner successivement selon
les 11 rôles ci-dessous, puis seulement valider l'implémentation.

Une « décision importante » = tout ce qui touche au schéma de base, à la
sécurité, à l'architecture, aux dépendances, ou tout changement de plus de
~50 lignes.

---

## 1. 🏛️ Architecte logiciel
- Cette modification respecte-t-elle les couches (`UI → ViewModel → Repository → DAO`) ?
- Crée-t-elle un couplage nouveau ? Une dépendance circulaire ?
- Rapproche-t-elle ou éloigne-t-elle de la cible de `ARCHITECTURE.md` ?
- Que devient ce choix si le projet double de taille ?
- **Question piège sur ce projet** : est-ce que j'alourdis encore
  `MainRepository` (992 l.) ou `MainViewModel` (586 l.) ?

## 2. 📱 Développeur Android senior
- Cycle de vie respecté (rotation, mort du processus, retour arrière) ?
- Fuite de `Context`, d'Activity, de `NavController` ?
- Comportement sur Android 7 (minSdk 24) **et** Android 15 ?
- Que se passe-t-il en mode avion, batterie faible, appareil lent ?
- Les permissions manquantes sont-elles gérées sans crash ?

## 3. 🅺 Expert Kotlin
- Nullabilité correcte, aucun `!!` non justifié ?
- Immutabilité privilégiée (`val`, `data class`, collections en lecture seule) ?
- Concurrence structurée, pas de scope orphelin ?
- `CancellationException` non avalée par un `catch (e: Exception)` ?
- Idiomes appropriés (`sealed`, `when` exhaustif, fonctions d'extension) ?

## 4. 🗄️ Expert Room
- Le schéma généré correspond-il **exactement** à ce que produit la migration ?
- Faut-il incrémenter la version ? La migration est-elle testée ?
- Les index nécessaires existent-ils (clés étrangères, colonnes filtrées) ?
- Les opérations multi-tables sont-elles dans `withTransaction` ?
- Un `Flow` mal cadré déclenche-t-il des recompositions en cascade ?
- **Rappel projet** : `exportSchema = false` et 6 migrations divergentes (BUG-001).

## 5. 🎨 Expert Jetpack Compose
- Recompositions maîtrisées ? Paramètres stables ? `key` sur les listes ?
- État hissé au bon niveau (*state hoisting*) ?
- `collectAsStateWithLifecycle` plutôt que `collectAsState` ?
- Material 3 uniquement, couleurs issues du thème ?
- Preview possible sans base de données ?
- Accessibilité : `contentDescription`, taille des cibles, contraste plein soleil ?

## 6. 💉 Expert Hilt
- La portée est-elle correcte (`@Singleton` vs `@ViewModelScoped`) ?
- Le graphe de dépendances reste-t-il lisible ?
- `@ApplicationContext` et non un contexte d'Activity ?
- Les points d'entrée hors-Compose (Worker, BroadcastReceiver) sont-ils couverts ?
- Cette dépendance est-elle substituable en test ?

## 7. 🧮 Expert SQL
- La requête est-elle indexée ? Provoque-t-elle un scan complet ?
- Le filtrage et l'agrégation sont-ils faits en SQL plutôt qu'en Kotlin ?
- Les `JOIN` sont-ils corrects sur les données réelles (nullables, orphelins) ?
- Comportement avec 50 000 ventes, pas seulement 10 ?
- Aucune concaténation de chaîne dans le SQL ?

## 8. 🧪 Ingénieur QA
- Quels sont les cas limites ? (zéro, négatif, `null`, chaîne vide, très grand)
- Que se passe-t-il si l'utilisateur double-tape, tourne l'écran, coupe l'app ?
- Comment prouver que cette modification **ne casse rien** ?
- Peut-on écrire un test automatisé ? Sinon, quel est le protocole manuel ?
- Le comportement d'erreur est-il visible et compréhensible par le commerçant ?

## 9. 🔐 Expert sécurité
- Un secret est-il introduit dans le code ? Dans les logs ?
- La donnée personnelle reste-t-elle sur l'appareil ?
- Cette modification affaiblit-elle le chiffrement ou l'authentification ?
- Un employé mal intentionné peut-il en tirer parti ?
- Faut-il tracer l'action dans `action_logs` ?

## 10. ⚙️ Ingénieur DevOps
- Le build reste-t-il reproductible ? La dépendance est-elle dans le catalog ?
- Impact sur la durée de build, la taille de l'APK ?
- Faut-il une règle R8 ?
- Est-ce vérifiable en CI, sans appareil ?
- La migration est-elle déployable progressivement ?

## 11. 👁️ Relecteur de code
- Le nom dit-il exactement ce que fait la chose ?
- Y a-t-il duplication avec du code existant ? (`grep` fait ?)
- Un développeur découvrant le projet comprend-il en 30 secondes ?
- Le commentaire explique-t-il le **pourquoi** ?
- Le diff est-il minimal, sans reformatage parasite ?
- `.ai/` a-t-il été mis à jour ?

---

## Grille de synthèse

À recopier dans `REPORTS/` pour toute décision structurante :

```markdown
### Décision : <intitulé>

| Rôle | Verdict | Réserve principale |
|---|---|---|
| Architecte | ✅ / ⚠️ / ❌ | |
| Dev Android senior | | |
| Expert Kotlin | | |
| Expert Room | | |
| Expert Compose | | |
| Expert Hilt | | |
| Expert SQL | | |
| Ingénieur QA | | |
| Expert sécurité | | |
| Ingénieur DevOps | | |
| Relecteur | | |

**Décision retenue** :
**Alternatives écartées** :
**Risque résiduel accepté** :
```

**Règle d'arbitrage** : un ❌ de l'**Expert sécurité** ou de l'**Expert Room**
est bloquant sur ce projet (données financières irremplaçables). Les autres
réserves se négocient et se documentent.
