# Audit fonctionnel à l'exécution — pages, boutons, parcours

- **Date** : 2026-08-27
- **Méthode** : exécution réelle (Postgres embarqué :55432 + `next dev` :3000,
  seed, 3 rôles customer/host/admin) + scans statiques croisés
  (boutons sans action, `fetch /api/*` sans route, routes orphelines d'UI,
  boutons icône sans label, données codées en dur).
- **Niveau** : S (analyse produit, pas de refonte).

## Synthèse

Le produit est **largement complet et cohérent** : les 41 pages répondent
200, les 3 rôles s'authentifient, messagerie / réservations / avis /
favoris / promos / settings / providers / calendrier de dispo sont branchés
de bout en bout. Aucun `fetch('/api/...')` ne pointe vers une route
inexistante (0), et aucune route métier importante n'est orpheline d'UI
(les 7 cas signalés par le scan sont des faux positifs littéraux — les
endpoints sont appelés via des composants : `availability-calendar`,
`new-room-form`, `user-suspend-actions`, etc.).

## Défauts corrigés dans cette session (bugs UI, sans régression)

| # | Défaut | Fichier | Correctif | Preuve |
|---|---|---|---|---|
| F1 | **Bouton « télécharger la facture » mort** (icône Download sans `onClick`) dans la liste des factures | `src/app/dashboard/billing/page.tsx` | Remplacé par un lien `<a href="/api/dashboard/billing/export">` (export CSV réel, déjà autorisé host/admin) + `aria-label` descriptif | 🔨 typecheck/build · ▶️ export 200 `text/csv`, 403 customer · scan : 0 bouton mort |
| F2 | **Bouton de fermeture des toasts sans libellé accessible** (icône X seule, pas de `aria-label`) | `src/components/ui/toast.tsx` | Ajout `type="button"` + `aria-label="Fermer la notification"` + `aria-hidden` sur l'icône | 🔨 · scan a11y : 0 bouton icône sans label |

Aucun de ces deux changements ne modifie de logique serveur, de schéma ou
de contrat d'API : ce sont des corrections de présentation/accessibilité.

## Écarts « mal pensés » — à verser au backlog (évolutions, pas des bugs)

Ce sont des **manques produit** honnêtement documentés dans `FEATURES.md` /
`KNOWN_LIMITATIONS.md`, non des régressions. Classés par valeur/risque.

### E1 — Photos d'annonce : champ URL au lieu d'un upload (P2, UX)
- **Constat** : `dashboard/properties/new` demande « URL de l'image » ;
  l'endpoint `POST /api/uploads` (utilisé par `message-composer` pour les
  pièces jointes) n'est **pas proposé** pour les photos de bien.
- **Problème** : un hôte non technique ne peut pas héberger une photo ;
  l'upload existe déjà mais n'est pas réutilisé ici.
- **Solution sans régression** : ajouter un `<input type="file">` qui
  réutilise `POST /api/uploads` (même contrat que `message-composer`),
  garde le champ URL comme alternative, et remplit `formData.mainImage`
  avec l'URL renvoyée. Aucun changement d'API : le serveur sait déjà
  recevoir un fichier.

### E2 — Page BestRewards purement descriptive (P3, produit)
- **Constat** : `/bestrewards` affiche des niveaux/gains **codés en dur**
  (niveaux 1/2/3, « cashback 5% ») ; elle lit `getSetting('bestrewards')`
  mais n'affiche **ni le niveau réel, ni le wallet, ni le code de
  parrainage** de l'utilisateur connecté.
- **Problème** : le back-end sait tout ça (`/api/auth/me` → `walletBalance`,
  `/api/users/me/referral` → code, `src/lib/loyalty.ts` → niveau) mais
  l'écran ne le montre pas ; l'utilisateur ne voit pas son avantage réel.
- **Solution sans régression** : transformer la partie haute en composant
  client qui fetch `/api/auth/me` + `/api/users/me/referral` et affiche
  niveau actuel, séjours avant palier suivant, solde wallet, code de
  parrainage (avec bouton copier). Le reste (FAQ, niveaux) reste statique.

### E3 — Factures légales absentes (P2, finance/conformité)
- **Constat** : la page facturation affiche « Factures légales
  indisponibles » ; seul un export CSV opérationnel existe (volontairement
  non facturier, commentaire de route).
- **Solution** : évolution dédiée (génération PDF facturier avec mentions
  légales, TVA, coordonnées) — à cadrer comme tâche **C** (finance). Hors
  périmètre de ce correctif.

### E4 — Sous-notations d'avis non exploitées (P3, données)
- **Constat** : l'API `/api/reviews` accepte 7 notes détaillées
  (propreté, confort, emplacement…), mais le formulaire n'envoie que
  `overallRating` + commentaires.
- **Solution** : ajouter les étoiles par critère dans
  `mes-reservations/avis/[id]` (champs `optional`, donc non bloquant).

## Documentation à réaligner (dette doc, sans impact code)

- **`PRODUCT_ACCEPTANCE.md` est obsolète** : il marque ❌/🚧 des parcours
  **déjà livrés et testés à l'exécution** (messagerie POST, mot de passe
  oublié, réponse aux avis, promos, suspension utilisateur, recherche par
  disponibilité `room_availability`). À régénérer depuis `FEATURES.md` et
  les preuves runtime pour ne plus induire de faux « manques » en erreur.

## Preuves (§16)

- ▶️ Exécution : 41 pages 200, login 3 rôles OK, messagerie
  customer→host OK, export CSV 200/403, wishlist token bidon 404,
  recherche par dates interroge bien `room_availability`.
- 🔨 `typecheck` 0 erreur · `build` 57/57.
- 🧪 `npm test` **228/228** (DB ouverte) · lint 0 erreur.
- ▶️ `npm run smoke` **91/91** · `npm run ai:check` 19 OK / 1 warn (R7
  transitoire) / 0 fail · scans : 0 bouton mort, 0 fetch orphelin,
  0 bouton icône sans label.
