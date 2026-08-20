# Prompt — nouvelle fonctionnalité

À adapter en remplaçant les `<…>`.

---

Objectif : ajouter **<décris la fonctionnalité en une phrase>** à
MyBestBooking.

Contexte utile :

- Modèle DB : voir `.ai/DATABASE.md` (14 tables déjà en place).
- Routes existantes : voir `.ai/API.md`.
- Pages existantes : voir `.ai/UI.md`.
- Conventions : voir `.ai/CODING_STYLE.md`.

Propose :

1. Le **modèle DB** minimal — nouvelle(s) table(s) ou colonnes, avec
   justification. Si besoin, met à jour `src/db/schema.ts`.
2. Le ou les **endpoints API** (méthode, chemin, payload Zod, réponses,
   règles d'auth par rôle).
3. Le(s) **écran(s) UI** touchés, avec le route group approprié
   (`(auth)`, `(main)`, `dashboard`).
4. Les **impacts** sur les fichiers existants.
5. Les **oublis probables** (pagination, i18n, tests, migration, notification).

Tu peux implémenter directement ; met à jour `.ai/API.md`, `.ai/DATABASE.md`,
`.ai/UI.md`, `.ai/DEVLOG.md` dans le même changement si pertinent.
