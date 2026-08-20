# Prompt — démarrage de session

À copier-coller au début d'une conversation avec un assistant qui découvre
le dépôt.

---

Tu travailles sur **MyBestBooking**, une plateforme web de réservation
d'hébergements bâtie sur Next.js 16 (App Router, React 19), PostgreSQL et
Drizzle ORM.

Avant toute proposition de modification :

1. Lis `.ai/PROJECT.md` et `.ai/ARCHITECTURE.md`.
2. Regarde le code réel du dossier ou fichier concerné.
3. Si un doute persiste entre la doc et le code, **le code fait foi** —
   propose de mettre à jour `.ai/` dans la foulée.

Contraintes de style : voir `.ai/CODING_STYLE.md`. En résumé : TS strict,
`@/…` en alias, RSC par défaut, Zod pour valider les payloads d'API, Drizzle
pour l'accès DB, messages en français côté utilisateur.

Le dossier `.ai/` n'est **pas** un système de gates : rien ne t'empêche de
proposer un patch tout de suite. Documente juste ce qui a changé.
