# 📁 `.ai/` — Documentation vivante de **MyBestBooking**

Ce dossier est un **aide-mémoire partagé** entre les développeurs (humains ou IA)
qui interviennent sur `hamad-sw-ui/MyBestBooking`. Il sert à retrouver
rapidement le contexte du projet — ce qu'il fait, comment il est bâti, où
regarder — sans avoir à relire l'intégralité du code.

## Ce que ce dossier **n'est pas**

- **Pas un système d'approbation**. Aucun fichier ici ne bloque un commit,
  une PR ou un déploiement. Rien à cocher pour avoir « le droit de coder ».
- **Pas une source figée**. Si une note diverge du code, **le code fait foi** ;
  la note doit être mise à jour à la volée, sans cérémonie.
- **Pas un cadre méthodologique imposé**. Pas de rôles obligatoires, pas de
  débat multi-rôles à produire, pas d'analyse d'impact préalable requise.

## Ce que ce dossier **est**

- Une **carte du projet** : à quoi ça sert, comment c'est structuré, quelles
  routes/API/tables existent.
- Un **journal libre** : décisions notables, bugs connus, idées à explorer.
- Une **collection de gabarits** (prompts, checklists) qu'on utilise **si on
  les trouve utiles**, jamais parce que c'est obligatoire.

## Carte des fichiers

| Fichier | Ce qu'on y trouve |
|---|---|
| `PROJECT.md` | Identité du projet, périmètre métier, stack, public visé |
| `ARCHITECTURE.md` | Arbre du code, couches, flux (auth, réservation), conventions Next.js |
| `DATABASE.md` | Schéma PostgreSQL/Drizzle table par table, index, relations |
| `API.md` | Liste des route handlers `/api/*` avec méthode, entrée, sortie, auth |
| `UI.md` | Cartographie des pages, design system, charte graphique |
| `SECURITY.md` | Modèle d'auth, cookies, hachage, points d'attention |
| `CODING_STYLE.md` | Conventions TypeScript / React / Drizzle / Tailwind du dépôt |
| `DEV_ENVIRONMENT.md` | Comment lancer le projet en local : `.env`, DB, scripts |
| `DEPENDENCIES.md` | Bibliothèques utilisées et pourquoi |
| `BUGS.md` | Bugs et bizarreries connus, ouverts ou fermés |
| `BACKLOG.md` | Idées et tâches à traiter, sans ordre ni engagement |
| `ROADMAP.md` | Direction générale — indicative, non contractuelle |
| `DEVLOG.md` | Journal libre : ce qu'on a fait, ce qu'on a appris |
| `PROMPTS/` | Prompts réutilisables pour un agent IA (facultatifs) |
| `CHECKLISTS/` | Aide-mémoire (facultatifs) avant commit / PR / release |
| `ADR/` | Décisions structurantes qu'on veut se rappeler plus tard |
| `REPORTS/` | Analyses ponctuelles (audits, benchmarks) rangées ici |
| `LOGS/` | Notes brutes de session si on souhaite en garder trace |

## Principe de fonctionnement

1. **Lire ce dont on a besoin**, pas plus. `PROJECT.md` + `ARCHITECTURE.md`
   suffisent pour se remettre dedans en 5 minutes.
2. **Mettre à jour à la volée** ce qu'on touche. Une modif dans le schéma DB ?
   On ajuste `DATABASE.md` dans le même commit. Une nouvelle route API ?
   Une ligne dans `API.md`.
3. **Rien n'oblige** à créer un rapport, un ADR ou une entrée `DEVLOG` — on le
   fait **si ça a de la valeur** pour la prochaine personne qui passera.
