# ADR-001 — Framework de gouvernance `.ai/` v1.0.0 (AI-DOS Web)

- **Date** : 2026-08-20
- **Statut** : accepté
- **Niveau** : S
- **Tâche associée** : B-000
- **Rapports liés** :
  - `REPORTS/analyse_impact_2026-08-20_governance_setup.md`
  - `REPORTS/analyse_conception_2026-08-20_governance_setup.md`

## Contexte

Le dépôt `MyBestBooking` héritait, dans son `.ai/`, du framework AI-DOS 3.0
du projet Android `MobileCaisse`. Ce framework, riche et éprouvé, décrivait
un tout autre projet (SQLCipher, Room, ESC/POS, parsing SMS MoMo) et
imposait des rituels calibrés pour un contexte financier hors-ligne.

Deux options extrêmes ont été essayées puis rejetées :

- **Tout supprimer et repartir sans gouvernance** — livré à la Session 1
  (commit `4ad8884`), a produit un aide-mémoire libre. Rejeté par le
  responsable : trop léger pour un projet destiné à gérer, à terme, des
  transactions financières réelles.
- **Reprendre AI-DOS tel quel en changeant les mots** — trop lourd pour un
  projet web à un seul développeur/agent en début de vie.

Le responsable a demandé un **hybride** : philosophie AI-DOS conservée,
contenu réécrit pour la stack Next.js + PostgreSQL + Drizzle, avec
proportionnalité T/L/S/C pour éviter la bureaucratie inutile.

## Décision

Adopter le framework **AI-DOS Web v1.0.0**, spécifié par :

1. `framework.manifest.json` — règles machine-lisibles :
   `mandatory_documents`, `blocking_rules`, `proportionality_levels T/L/S/C`,
   `evidence_tags`, 11 `roles`.
2. `CODING_RULES.md` — §1 à §17 + §22 conservés d'AI-DOS 3.0 (règle de
   clôture, analyse d'impact préalable, débat multi-rôles, honnêteté
   technique, rétrospective, audit des preuves).
3. `STATE.md` + `CURRENT_TASK.md` + `TRACEABILITY.md` — mémoire, tâche
   unique, matrice preuves ↔ tâches.
4. Checklists **bloquantes** `avant_commit`, `avant_pull_request`,
   `avant_release`.
5. Couche contenu conservée (`PROJECT`, `ARCHITECTURE`, `DATABASE`, `API`,
   `UI`, `SECURITY`, `CODING_STYLE`, `DEV_ENVIRONMENT`, `DEPENDENCIES`,
   `ROADMAP`, `BUGS`, `BACKLOG`, `DEVLOG`) — déjà en place depuis
   Session 1.

## Alternatives écartées

- **Kit ultra-léger (aide-mémoire libre)** — Session 1. Insuffisant pour un
  produit qui gérera à terme des paiements et des données personnelles.
- **AI-DOS Kotlin/Android tel quel** — hors sujet, imposerait des rituels
  (SQLCipher, Room, Compose) inapplicables ici.
- **Framework externe (ex : ARC42, C4 seul)** — bons outils de doc
  d'architecture mais ne couvrent pas la gouvernance opérationnelle
  (traçabilité, honnêteté, clôture) qui est le cœur de la demande.
- **CI-as-governance (règles imposées uniquement via GitHub Actions)** —
  bon complément, mais insuffisant sans support documentaire pour un
  agent IA qui doit raisonner sur les règles avant d'exécuter.

## Conséquences

### Positives

- Alignement clair sur MyBestBooking, aucun résidu MobileCaisse.
- Proportionnalité T/L/S/C : les micro-tâches ne portent pas la charge des
  décisions structurantes.
- Traçabilité formelle des preuves (§16 + §22) : un item marqué
  `VALIDÉ` sans preuve peut être **audité** et cassé.
- La couche contenu (Session 1) reste utile telle quelle — pas de perte.

### Négatives

- Rituels lourds pour les tâches C : analyse d'impact + conception +
  débat 11 rôles + double validation + ADR + rapports. Coût réel.
- Aucun outil automatisé ne fait respecter le framework aujourd'hui — la
  discipline dépend de chaque intervenant (voir `KNOWN_LIMITATIONS.md`
  → « Application manuelle du framework »).
- Duplication doc/code assumée : `DATABASE.md` peut diverger de
  `src/db/schema.ts` si personne ne met à jour. Compensée par §11.

### À suivre

Le framework sera **audité** après **5 sessions** (mesure §17). Tout item
qui n'a jamais servi sera candidat à la suppression. Toute règle qui aura
été **violée systématiquement** sera candidate à la reformulation.

## Preuves de mise en œuvre (§16)

- 🔍 Tous les documents obligatoires listés dans `framework.manifest.json`
  existent après commit (vérifiable via `ls .ai/`).
- 🔍 Les checklists `avant_commit`, `avant_pull_request`, `avant_release`
  portent l'avertissement ⛔ « bloquantes ».
- 🔍 `CURRENT_TASK.md` référence bien B-000.
- ❓ `framework.manifest.json` est syntaxiquement JSON — à confirmer par
  `jq . .ai/framework.manifest.json` en début de prochaine session.
- ❓ Aucun `npm run typecheck`/`build` — hors périmètre (100 % doc).

## Signatures

- Auteur : Arena Agent Mode (Session 2 du 2026-08-20)
- Validé par : _en attente du responsable_
