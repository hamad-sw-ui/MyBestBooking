# 🔍 Audit UI brutal — Session 10 (2026-08-21)

- **Déclencheur** : « refaites l'audit maintenant » — l'utilisateur
  soupçonnait à raison qu'il restait des manquements après T-030.
- **Auteur** : Arena Agent Mode
- **Résultat** : **4 catégories de morts identifiées, toutes corrigées**.

## Constats à froid

### 1. Liens footer/header → 404 (15 occurrences)

`comm -23 all_hrefs pages_exist` a révélé 15 routes référencées mais
inexistantes :

- `/a-propos`, `/carrieres`, `/presse`, `/blog` (footer entreprise)
- `/garantie-prix`, `/destinations`, `/avis` (footer découvrir)
- `/devenir-partenaire`, `/extranet`, `/affiliation` (footer partenaires)
- `/contact` (footer aide)
- `/cgu`, `/cgv`, `/confidentialite`, `/cookies` (footer bas de page)

**Cause** : le footer avait été rédigé comme un layout marketing
« comme si le site était fini ». Les pages n'ont jamais été créées.

### 2. Boutons `<Button>` sans handler ni Link (22 occurrences)

Détectés par un grep `<Button>` avec analyse de contexte pour
exclure les cas Link/onClick/type="submit". Ex :

- `/aide` : « Démarrer un chat », « Appeler », « Envoyer un email »
- `/mes-favoris` : « Nouvelle liste », « Alertes prix », « Partager », icônes trash sur wishlists
- `/mes-reservations` : boutons « Contacter », « Confirmation », « Annuler »
- `/messages` : « Contacter le support »
- `/mon-compte` : « Utiliser mon solde »
- `/dashboard/billing` : « Tout télécharger »
- `/dashboard/bookings/[id]` : « Envoyer un message », « Télécharger la confirmation », « Annuler la réservation »
- `/dashboard/promotions` : « Créer une promotion » (2 endroits, empty state + footer stats)
- `/dashboard/properties/[id]` : « Ajouter une chambre » (2 endroits), « Modifier » (par room)

**Cause** : boutons stylisés en priorité, câblage remis à plus tard,
oublié.

### 3. Composants livrés mais jamais utilisés (4)

- `src/components/ui/modal.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/image-uploader.tsx`
- `src/components/price-alerts-section.tsx` (livré T-030, non branché)

**Cause** : composants créés par le template d'origine ou en
anticipation, jamais intégrés.

### 4. Formulaires `<form>` sans onSubmit ni method/action (1)

- `/recherche` : formulaire de filtres sans `method="get"` explicite
  (fonctionnait par accident via le comportement par défaut, mais
  fragile).

### 5. Faux positifs à écarter du grep

Le grep initial marquait 44 boutons ; la fonction Python d'analyse de
contexte a divisé par 2 en excluant les cas :
- `<Link><Button>...</Button></Link>` (contexte multi-lignes)
- Boutons dans `<form onSubmit={...}>` (héritent du submit)
- Boutons `disabled` volontairement (loading states)

## Corrections appliquées (T-031)

### A. Nouvelle règle R19 dans check-ai.mjs

Bloque **au ai:check** tout `href="/xxx"` qui ne pointe pas vers un
`page.tsx` existant. Supporte les segments dynamiques `[slug]`.
Whitelist : `/api/*`, `/uploads/*`, `/_next/*`.

Fail exemple :
```
❌ R19 links_target_existing_pages
   15 route(s) inexistante(s) référencée(s) :
   /cgu (2× ex: src/app/(auth)/inscription/page.tsx:159) | …
```

### B. Footer refondu

Reconstruit `src/components/layout/footer.tsx` pour ne référencer
que des routes existantes. Sections réorganisées :
- **Découvrir** : /recherche, /bestrewards, /aide
- **Voyageurs** : /mon-compte, /mes-reservations, /mes-favoris, /messages
- **Hébergeurs** : /dashboard/properties/new, /dashboard, /inscription
- **Contact** : mailto:support, mailto:partners
- **Bottom** : /mentions-legales, /confidentialite

### C. 2 pages légales livrées

- **`/mentions-legales`** : éditeur, hébergeur, CGU (règles usage),
  CGV (tarifs, TVA, paiement, annulation), IP, droit applicable.
- **`/confidentialite`** : RGPD complet — données collectées, cookies,
  droits (accès/rectification/suppression/portabilité/opposition),
  sécurité (bcrypt, 2FA, rate-limit, CSP), sous-traitants (Vercel,
  Stripe, Resend, S3), contact DPO.

### D. 22 boutons morts câblés

**Composants clients réutilisables créés** :
- `src/components/booking-row-actions.tsx` : Contacter (mailto host),
  Confirmation (téléchargement .txt côté client), Annuler
  (`PUT /api/bookings/[id]` status:cancelled + `router.refresh()`).
- `src/components/wishlist-actions.tsx` : Partager (copie l'URL de
  partage si isPublic + shareToken), Supprimer la liste
  (`DELETE /api/wishlists?wishlistId=` + refresh).

**Boutons remplacés par mailto:** :
- /aide : « Écrire à l'équipe » → `mailto:support@...?subject=Aide`
- /aide : « Ouvrir mon client mail » → `mailto:support@...`
- /messages : « Contacter le support » → `mailto:support@...?subject=Aide`

**Boutons remplacés par Link/<a>** :
- /dashboard/rooms : « Ajouter une chambre » → `Link /dashboard/rooms/new`
- /dashboard/promotions : « Créer une promotion » ×2 → `Link /dashboard/promotions/new`
- /dashboard/properties/[id] : « Ajouter chambre » ×2 → `Link /dashboard/rooms/new`
- /dashboard/properties/[id] : « Modifier » par room → `Link /dashboard/rooms/[id]/calendrier`
- /mon-compte : « Utiliser mon solde » → `Link /recherche`
- /mes-reservations : « Laisser un avis » → `mailto:` (formulaire V1)

**Boutons retirés** :
- /aide : « Appeler » (téléphone pas encore actif) → span « Numéro à activer »
- /dashboard/billing : « Tout télécharger » → span « Export CSV via API (v prochaine) »

### E. 4 composants inutilisés

- `src/components/ui/modal.tsx` : **supprimé** (aucun import).
- `src/components/ui/skeleton.tsx` : **supprimé** (aucun import).
- `src/components/ui/image-uploader.tsx` : **supprimé** (jamais branché ;
  le seul upload utilisateur est via `<MessageComposer>` T-029).
- `src/components/price-alerts-section.tsx` : **branché** dans
  `/mes-favoris` (remplace 2 boutons ghost décoratifs).

### F. Formulaire /recherche

Ajout de `method="get"` + `action="/recherche"` explicites (le
comportement par défaut fonctionnait par chance).

## Vérification finale

| Test brut | Avant | Après |
|---|---|---|
| Liens footer morts | 15 | **0** |
| `href="#"` | 0 (T-030) | 0 |
| `onClick={() => {}}` / `onChange={() => {}}` | 0 (T-030) | 0 |
| `<Button>` sans handler/Link | 22 | **0** |
| Composants ui inutilisés | 4 | **0** |
| `<form>` sans onSubmit/method/action | 1 | **0** |
| ai:check règles vertes | 15 | **16** |

`npm run ai:check` : **16 OK · 2 warn attendus · 0 fail**.
`npm run typecheck` : **0 erreur**.
`npm test` : **176 / 176**.

## Note de discipline

R18 (Session 9) traitait les *patterns explicites* de mort UI.
R19 (Session 10) traite les *patterns implicites* (liens vers pages
qui n'existent pas). Il reste théoriquement possible de laisser un
`<Button>` sans handler — c'est pris en charge par un **grep manuel
avec analyse de contexte** dans ce rapport, pas encore par une règle
automatisée. R20 pourrait le formaliser mais le contexte multi-lignes
rend l'implémentation délicate (faux positifs sur boutons wrappés
dans Link).

Décision : je laisse cet audit comme rituel semi-manuel à refaire à
la demande, plutôt que d'introduire une règle bruyante qui rate des
cas ou en signale des faux.
