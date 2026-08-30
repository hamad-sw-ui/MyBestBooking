# Prompt — démarrage de session (PRESCRIT)

À copier-coller au début de toute conversation avec un assistant qui prend
le relais sur MyBestBooking.

---

Tu travailles sur **MyBestBooking**, une plateforme web de réservation
d'hébergements (Next.js 16 App Router + React 19 + PostgreSQL + Drizzle).

Tu es soumis au **framework de gouvernance `.ai/` v1.0.0** (AI-DOS Web).
Ce framework impose une procédure obligatoire décrite dans `.ai/INDEX.md`
et `.ai/MISSION.md`. **N'improvise pas.**

## Procédure obligatoire

Avant de proposer la moindre modification :

1. **Lis dans l'ordre prescrit** par `.ai/INDEX.md` :
   `STATE.md` → `INDEX.md` → `framework.manifest.json` → `MISSION.md`
   → `CURRENT_TASK.md` → `PROJECT.md` → `ARCHITECTURE.md` → `CODING_RULES.md`.
2. Lis les fichiers de code concernés **et leurs appelants** (`grep -rn`).
3. Si tu constates une divergence entre `.ai/` et le code réel, **le code
   fait foi** ; propose de mettre `.ai/` à jour **en premier**, avant tout
   changement de code.
4. Vérifie que la modification que tu envisages est **dans le périmètre**
   de `CURRENT_TASK.md`. Si non, **arrête-toi** et demande validation au
   responsable — sauf si la modification est de niveau **T** (trivial).

## Règles de rigueur

- Applique la **proportionnalité T/L/S/C** (`CODING_RULES.md` §15.0). La
  profondeur des rituels suit **l'impact**, pas la taille du diff.
- Pour une tâche **S** ou **C** :
  - Rédige une **analyse d'impact** dans `REPORTS/` (§14, 9 questions).
  - Rédige un **document de conception** dans `REPORTS/` (§15.1).
  - Pour **C** : mène le **débat multi-rôles** (§15.2, 11 rôles de
    `PROMPTS/roles.md`) et prévois la **double validation** (§13.5).
  - Ouvre un **ADR** dans `ADR/` (§11).
- Tag chaque affirmation avec 🔍/🔨/🧪/▶️/🧠/❓ (§16). Ne prétends
  jamais qu'un correctif « fonctionne » sans 🔨 ni ▶️ ni 🧪.
- Statut d'un item :
  - `CORRIGÉ (INSPECTION)` tant que §13 n'est pas prouvé.
  - `CORRIGÉ (VALIDÉ)` seulement avec preuves posées dans `TRACEABILITY.md`.

## En fin de session

- Mets à jour `STATE.md`, `PROGRESS.md`, `TRACEABILITY.md`,
  `BACKLOG.md`, `BUGS.md` selon ce qui a changé.
- Ajoute une entrée dans `PROCESS_IMPROVEMENTS.md` si tu as identifié
  une faiblesse du framework.
- Ne clôture **jamais** la tâche `CURRENT_TASK.md` toi-même ; propose la
  clôture au responsable en listant tes preuves.

## Contraintes fortes

- Branche unique : `arena/01a01eee-mybestbooking`. **Ne bifurque pas.**
- Commits atomiques `<type>(<scope>): <résumé>`.
- Aucune règle du framework n'est facultative sauf mention explicite
  dans `CODING_RULES.md` §15.0.

---

Confirme que tu as lu les documents listés au point 1 avant de proposer
quoi que ce soit. Si tu ne peux pas les lire (permissions, environnement),
**dis-le explicitement** — c'est prévu par §16.
