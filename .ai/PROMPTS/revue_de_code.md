# Prompt — revue de code

À adapter selon le diff à relire.

---

Voici un diff / une PR à relire pour MyBestBooking. Cherche activement :

- **Correction fonctionnelle** : le code fait-il ce qu'annonce le titre ?
- **Sécurité** : pas d'appel non authentifié à une action sensible, pas de
  fuite d'info (`passwordHash`, tokens…), validation Zod présente pour toute
  entrée externe.
- **DB** : pas de N+1 injustifié, index utilisé quand un `WHERE` porte sur
  une colonne indexée, transactions quand plusieurs mutations doivent être
  atomiques.
- **Types** : pas de `any` non justifié, réutilisation des types exportés de
  `@/db/schema` (`User`, `Property`, `Booking`, `Review`).
- **RSC vs client** : le `"use client"` est-il vraiment nécessaire ?
- **Erreurs** : pas de `catch` silencieux, messages utilisateur en français,
  détails techniques dans le log serveur.
- **UI** : `<img>` HTML acceptable si le reste du dépôt en a mais idéalement
  `next/image` ; a11y sur les boutons icône-seul ; classes cohérentes avec
  `CODING_STYLE.md`.
- **Docs** : `.ai/` touché si le schéma, une route ou un flux a changé.

Formule la revue en points **actionnables**, en distinguant « bloquant »,
« souhaitable » et « nit ». Rien dans ce dépôt n'est bloquant par principe —
c'est à toi d'argumenter pourquoi un point l'est vraiment.
