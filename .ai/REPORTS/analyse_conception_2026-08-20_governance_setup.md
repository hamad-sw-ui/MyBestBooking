# Analyse de conception — Framework de gouvernance `.ai/` v1.0.0

- **Date** : 2026-08-20
- **Tâche** : B-000
- **Niveau** : S
- **Auteur** : Arena Agent Mode
- **Référence** : `CODING_RULES.md` §15.1

---

## Options considérées

### Option A — Réutiliser AI-DOS 3.0 tel quel

Reprendre l'intégralité du framework AI-DOS 3.0 (MobileCaisse) en changeant
uniquement les mentions Android/Kotlin/Room/SQLCipher par Next.js/TypeScript/Drizzle/PostgreSQL.

**Avantages** :
- Framework mature, éprouvé sur 11 sessions du projet MobileCaisse.
- Cohérence numérique des règles (§13, §14, §16, §22 déjà connues).
- Rien à inventer.

**Inconvénients** :
- Rituels calibrés pour un contexte financier hors-ligne (SQLCipher,
  BackupManager, migrations Room destructives). Beaucoup ne s'appliquent
  pas.
- Vocabulaire trompeur (Docker `make verify`, `MainRepository`,
  `AppDatabase`) qui va troubler un futur agent.
- Pas de traitement UX / a11y / RSC : angles morts pour un projet web.

### Option B — Framework 100 % neuf pour le web

Concevoir un framework spécifique Next.js/React/Drizzle sans référence à
AI-DOS.

**Avantages** :
- Vocabulaire natif, prompts directement pertinents.
- Pas de dette conceptuelle héritée.

**Inconvénients** :
- Réinvention coûteuse. Les concepts de gouvernance (traçabilité,
  proportionnalité, honnêteté technique, audit des preuves) ne sont pas
  spécifiques Android.
- Absence de continuité — les prochaines équipes AI-DOS ne
  retrouveraient pas leurs repères.
- Risque d'oublier des règles gagnantes déjà éprouvées.

### Option C — Hybride (retenu)

Conserver **la philosophie AI-DOS** (§13, §14, §15, §16, §17, §22,
proportionnalité T/L/S/C, tags de preuve, débat multi-rôles, ADR,
traçabilité) et **réécrire tout le contenu** pour la stack web.

**Avantages** :
- Meilleur des deux : rigueur éprouvée + vocabulaire pertinent.
- Numérotation §13–§22 préservée → références externes toujours valides.
- Onboarding aisé pour quelqu'un qui connaît déjà AI-DOS.

**Inconvénients** :
- Nécessite de discriminer manuellement, règle par règle, ce qui reste
  pertinent et ce qui ne l'est plus.
- Compromis rédactionnel : rester fidèle à l'esprit AI-DOS sans être
  esclave de sa forme.

## Option retenue : **C — Hybride**

Décision motivée par la demande explicite du responsable (« Sur quelle
base partir ? → Hybride ») et par le fait que la couche contenu
(Session 1) était déjà web-native.

## Alternatives d'implémentation évaluées à l'intérieur de C

### C.1 — Manifest JSON vs. règles uniquement en Markdown

- Choisi : **`framework.manifest.json`**. Permet à une future CI ou à un
  script de valider mécaniquement la présence des documents obligatoires
  (`mandatory_documents`, `blocking_rules`).
- Écarté : « tout en Markdown » — pas de source machine-lisible.

### C.2 — Proportionnalité T/L/S/C vs. niveau unique

- Choisi : **T/L/S/C**. Sinon, une typo devrait produire une analyse
  d'impact + un ADR — coût inacceptable, non-adoption garantie.
- Écarté : « toutes les tâches suivent la même procédure ». Rejeté par
  expérience AI-DOS.

### C.3 — Checklists bloquantes vs. suggestives

- Choisi : **bloquantes**, avec justification écrite acceptée pour
  contourner. Formule qui protège du « je n'ai pas eu le temps » sans
  interdire le pragmatisme.
- Écarté : « suggestives » — équivalent à ne pas les avoir (Session 1
  l'a démontré).

### C.4 — Nombre de rôles pour le débat multi-rôles

- Choisi : **11 rôles**, adaptés au web (Architecte, Next.js senior, TS,
  React, Drizzle/SQL, PostgreSQL, sécurité web, QA, DevOps, UX/a11y,
  Relecteur). Miroir des 11 rôles AI-DOS 3.0.
- Écarté : « 5 rôles » — perd les angles a11y et Relecteur (advocatus
  diaboli), qui sont précisément ceux qui rattrapent les bugs vicieux.

### C.5 — `CURRENT_TASK.md` unique vs. plusieurs tâches parallèles

- Choisi : **unique**. Cohérent avec AI-DOS et avec la réalité mono-agent
  actuelle. Facilite l'audit § 22.
- Écarté : « pool de tâches actives » — pertinent à équipe de 5+, hors
  contexte ici.

## Plan de migration

**Aucune migration technique.** Le déploiement du framework est instantané :
le commit qui pose les fichiers rend le framework opérationnel. Un agent
qui prend la main dans la session suivante applique
`PROMPTS/session_start.md`.

Pour un développeur humain reprenant le projet :

1. Lire `README.md` puis `INDEX.md`.
2. Ouvrir `STATE.md` et `CURRENT_TASK.md`.
3. Suivre l'ordre de lecture prescrit.

Aucune formation ni synchronisation n'est nécessaire pour les autres
composants du projet (le code, la DB, l'infra ne changent pas).

## Critères de succès

À vérifier après **3 sessions** :

- Chaque session a une entrée dans `PROGRESS.md`.
- Chaque tâche S/C a produit `analyse_impact_*` + `analyse_conception_*`
  dans `REPORTS/`.
- Chaque tâche C a produit `debat_technique_*`.
- Chaque décision structurante a produit un `ADR-NNN_...`.
- `TRACEABILITY.md` a une ligne par item clôturé.
- Aucune règle §1–§22 n'a été violée sans justification écrite.

Si l'un de ces critères tombe systématiquement, une **rétrospective §17**
propose soit d'assouplir la règle, soit d'automatiser sa vérification, soit
de la retirer.

## Signatures

- Auteur : Arena Agent Mode (Session 2 du 2026-08-20)
- Validé par : _en attente du responsable_
