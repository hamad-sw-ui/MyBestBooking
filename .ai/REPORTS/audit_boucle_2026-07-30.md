# Audit — première exécution complète possible de `./software-factory/run`

**Date** : 2026-07-30 · **Objet** : identifier ce qui bloque encore la boucle réelle

## Classement des blocages

| Étape | Blocage | Classe | Traitement |
|---|---|---|---|
| détection | — | — | ✅ opérationnel |
| **provision** | Message trompeur : « environnement déjà complet » alors que le SDK est absent | **1 — automatisable** | ✅ **corrigé** ce jour |
| **provision** | SDK totalement absent → installer Android Studio | **2 — autorisation humaine** | téléchargement de plusieurs Go, décision explicite |
| preflight | — | — | ✅ opérationnel (0 erreur) |
| **autofix** | 141 corrections appliquées sans compilation de référence, **sans retour arrière** | **1 — automatisable** | ✅ **corrigé** ce jour |
| **compilation** | Ni Docker ni JDK 21 dans le sandbox | **3 — machine réelle** | `./software-factory/run` sur votre poste |
| tests unitaires | dépend de la compilation | 3 | idem |
| **ADB / émulateur** | Popup « Autoriser le débogage USB » | **2 — autorisation humaine** | non automatisable par conception (sécurité Android) |
| instrumentation | dépend d'adb | 3 | idem |
| analyse | — | — | ✅ opérationnel (10/10 tests) |
| revalidation | — | — | ✅ `--max-loops` |
| promotion | — | — | ✅ opérationnel (7 promus / 4 maintenus en simulation) |

## Synthèse

| Classe | Nombre | État |
|---|---|---|
| 1 — automatisable par la Software Factory | 2 | ✅ **tous deux corrigés ce jour** |
| 2 — autorisation humaine | 2 | irréductibles : installation multi-Go, popup de sécurité |
| 3 — impossible en sandbox, possible sur machine réelle | 4 | une seule commande les débloque |

**Aucun nouveau module créé** : les deux blocages de classe 1 étaient des
défauts dans du code existant.

## Les deux corrections

### 1. `ProvisionRunner` confondait deux situations distinctes

```python
actions = [a for a in plan(ctx.env) if a.command]   # filtre les actions manuelles
if not actions:
    return False, "environnement déjà complet"       # ← faux
```

« Rien à faire » et « rien que je puisse faire » ne sont pas la même chose.
Un SDK absent était masqué derrière un message rassurant. Le runner distingue
désormais les deux et affiche l'action manuelle attendue.

### 2. `autofix` modifiait le code sans filet

141 corrections avaient été appliquées **sans qu'aucune compilation ne les
valide**. Si l'une cassait le build, rien ne permettait de le savoir ni de
revenir en arrière.

Le moteur mémorise maintenant un point de restauration git avant `autofix`.
Si la compilation échoue juste après, il annule, recompile, et **tranche** :

- build vert après annulation → *autofix était la cause*, corrections écartées ;
- build toujours rouge → *le code était déjà en échec*, autofix hors de cause.

Vérifié : modification simulée puis annulée, fichier identique à la référence.

## Première exécution complète

Elle est possible **dès maintenant sur votre machine**, à une condition :
Android Studio installé (il fournit JDK 21 et le SDK). Le reste — licences,
platform-35, build-tools, AVD — est provisionné automatiquement.

```bash
./software-factory/run --push
```
