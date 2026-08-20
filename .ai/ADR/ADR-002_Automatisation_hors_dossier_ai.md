# ADR-002 — Le framework `.ai/` peut produire du code de vérification hors de `.ai/`

- **Date** : 2026-08-20
- **Statut** : accepté
- **Niveau** : S
- **Tâche associée** : T-000 v1.1
- **Rapports liés** :
  - `REPORTS/audit_2026-08-20_framework_v1.0.0.md`
  - `PROCESS_IMPROVEMENTS.md` → Session 3

## Contexte

L'auto-audit du framework v1.0.0 (Session 3) a détecté 10 défauts. Cinq
d'entre eux sont **vérifiables mécaniquement** :

- présence des documents `mandatory_documents` du manifest,
- validité JSON du manifest,
- HEAD de `STATE.md` à jour avec Git,
- alignement `manifest.roles` ↔ `PROMPTS/roles.md`,
- ordre de lecture `manifest.reading_order` ↔ `INDEX.md`.

`PROCESS_IMPROVEMENTS.md` avait déjà proposé `scripts/check-ai.mjs` mais
noté : « sortirait du périmètre `.ai/` (`scripts/` = code) ». Cette
question doit être tranchée avant d'écrire le script.

## Décision

**Le framework `.ai/` peut légitimement produire du code de vérification
hors de son propre dossier**, à condition que ce code :

1. **N'ait pas de dépendance runtime** ajoutée au projet (Node standard
   library uniquement, ou dépendances déjà présentes).
2. **Soit invocable via un script npm dédié** clairement préfixé `ai:*`
   (ex : `npm run ai:check`) pour signaler qu'il fait partie de la
   couche gouvernance.
3. **Soit piloté par `framework.manifest.json`** — le script lit les
   règles du framework, il ne les réimplémente pas en dur.
4. **N'échoue jamais silencieusement** — le code de retour reflète
   l'état réel, un défaut détecté = code de sortie non nul.
5. **Reste optionnel côté runtime applicatif** — le build/typecheck/lint
   du produit ne dépendent pas de `ai:check`.

Concrètement, cela autorise :

- `scripts/check-ai.mjs` — vérifie la cohérence du framework.
- `scripts/ai-*.mjs` futurs (ex : générateur de squelette d'ADR).
- Une entrée `ai:check` dans `package.json → scripts`.
- À terme, un job GitHub Actions dédié qui exécute `npm run ai:check`
  sur chaque PR touchant `.ai/`.

## Alternatives écartées

- **Tout garder dans `.ai/`** (ex : `.ai/scripts/check.mjs`). Écarté :
  Next.js ignore les scripts hors des chemins conventionnels, et cacher
  du code exécutable dans un dossier de documentation est trompeur pour
  un lecteur.
- **Script bash `.ai/check.sh`** — écarté : moins lisible que Node, moins
  portable Windows, plus difficile à tester.
- **Pas d'automatisation, discipline seule** — écarté : Session 1 → 3 a
  déjà montré que la discipline seule laisse passer des incohérences (10
  défauts trouvés à l'audit alors qu'on venait tout juste de créer le
  framework).
- **Hook Git `pre-commit`** — bonne idée en complément, mais rejetée
  comme mécanisme unique car un hook ne s'exécute pas dans la CI et
  peut être bypassé avec `--no-verify`. Réservé à une itération
  ultérieure.

## Conséquences

### Positives

- La cohérence du framework devient **vérifiable en une commande**.
- L'ajout d'une règle machine-lisible dans `framework.manifest.json`
  peut être immédiatement testé en étendant le script.
- Ouvre la voie à une CI de gouvernance (job dédié) plus tard.

### Négatives

- Nouveau fichier `scripts/check-ai.mjs` à maintenir. Sa complexité
  doit être **bornée** — s'il devient plus long que ~300 lignes, revoir
  l'architecture (ADR nouveau).
- Le script devient de fait **partie du framework** : sa modification
  suit désormais §15.0-bis (niveau C par défaut, S pour correction
  d'incohérence).

### À suivre

- Si un jour le nombre de scripts `ai:*` dépasse 3-4, envisager un
  dossier `scripts/ai/` dédié et une factorisation.
- Si la CI GitHub Actions est mise en place, ajouter un job
  `ai-check` en pré-requis du job `build`.

## Preuves de mise en œuvre (§16)

- 🔍 `scripts/check-ai.mjs` existe (à confirmer post-commit).
- 🔍 `package.json → scripts.ai:check` existe.
- ▶️ `npm run ai:check` retourne code 0 sur le HEAD courant — **preuve
  requise pour la clôture VALIDÉ de T-000 v1.1**, consignée dans
  `TRACEABILITY.md`.

## Signatures

- Auteur : Arena Agent Mode (Session 3 du 2026-08-20)
- Validé par : _en attente du responsable_
