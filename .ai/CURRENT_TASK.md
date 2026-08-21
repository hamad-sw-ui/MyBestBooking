# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-031
- **Titre** : R19 + audit UI brutal (liens morts, boutons câblés, composants nettoyés)
- **Niveau** : **S**
- **Ouverte le** : 2026-08-21 (Session 10)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

Réponse directe à « refaites l'audit maintenant » après T-030.
L'utilisateur soupçonnait à raison qu'il restait des manquements.
L'audit brutal a révélé 4 catégories de morts UI : 15 liens footer
→ 404, 22 boutons sans handler ni Link, 4 composants inutilisés,
1 formulaire sans method/action explicite.

## Livrables

### A. Framework (v1.1.2)

- **Nouvelle règle R19** dans `scripts/check-ai.mjs` : bloque
  `href="/xxx"` qui pointe vers une route sans `page.tsx` existant.
  Supporte segments dynamiques `[slug]`. Whitelist : `/api/*`,
  `/uploads/*`, `/_next/*`.
- **manifest.blocking_rules.link_to_nonexistent_page** ajoutée.
- Manifest version bumped 1.1.1 → 1.1.2.

### B. Footer refondu

`src/components/layout/footer.tsx` : ne référence plus que des routes
existantes. Sections : Découvrir, Voyageurs, Hébergeurs, Contact,
Bottom (mentions-legales + confidentialite).

### C. 2 pages légales livrées

- `/mentions-legales` : éditeur, hébergeur, CGU, CGV, IP, droit
  applicable.
- `/confidentialite` : RGPD complet (données, cookies, droits,
  sécurité, sous-traitants, DPO).

### D. 2 composants clients réutilisables

- `src/components/booking-row-actions.tsx` : Contacter (mailto),
  Confirmation (download .txt), Annuler (`PUT /api/bookings/[id]`).
- `src/components/wishlist-actions.tsx` : Partager (clipboard share
  URL), Supprimer (`DELETE /api/wishlists?wishlistId=`).

### E. 22 boutons morts câblés

- **mailto:** : /aide (chat, email), /messages (support),
  /mes-reservations (Laisser un avis)
- **Link** : /dashboard/rooms (Ajouter), /dashboard/promotions
  (Créer ×2), /dashboard/properties/[id] (Ajouter chambre ×2,
  Modifier room → calendrier), /mon-compte (Utiliser mon solde)
- **BookingRowActions** intégré dans /mes-reservations et
  /dashboard/bookings/[id]
- **WishlistActions** + **PriceAlertsSection** intégrés dans /mes-favoris
- **Retirés** : bouton « Appeler » (téléphone non actif) →
  span « Numéro à activer », bouton « Tout télécharger » dashboard/billing
  → span « Export CSV via API (v prochaine) »

### F. Composants inutilisés

- **Supprimés** : `ui/modal.tsx`, `ui/skeleton.tsx`,
  `ui/image-uploader.tsx` (aucun import).
- **Branché** : `price-alerts-section.tsx` (T-030) intégré dans /mes-favoris.

### G. Formulaire /recherche

Ajout de `method="get"` + `action="/recherche"` explicites.

## Preuves (§16)

- 🔍 `REPORTS/audit_ui_2026-08-21_session_10.md` (rapport détaillé).
- 🔨 `npm run typecheck` ✅ 0 erreur.
- 🔨 `npm run build` ✅ succès.
- 🔨 `npm run lint` ✅ 0 error.
- 🧪 `npm test` : **176 / 176** inchangé.
- 🧪 `npm run ai:check` : **16 OK · 2 warn · 0 fail** (R18 ✅, R19 ✅).
- ▶️ `/mentions-legales` et `/confidentialite` → 200.
- ▶️ /aide contient uniquement des `mailto:support@mybestbooking.com` et
  `mailto:partners@mybestbooking.com`, plus aucun bouton mort.
- ▶️ /mes-favoris : PriceAlertsSection + WishlistActions branchés,
  détectés dans le HTML rendu.
- ▶️ /mes-reservations : BookingRowActions branché.
- ▶️ Annulation booking via UI : `PUT /api/bookings/[id]
  {status:"cancelled"}` → 200 avec `fee: 0.00` calculé selon policy.
- ▶️ /dashboard/rooms/new → 200 (formulaire host).
- ▶️ /dashboard/promotions/new → 200.

## Grep final (audit reproductible)

Vous pouvez rejouer :
```bash
# 1. Liens footer/header morts
grep -rhoE 'href="/[a-z][a-z0-9/_-]*"' src/components/layout src/app \
  | sort -u | sed 's/href="//;s/"//' > /tmp/all_hrefs.txt
find src/app -name page.tsx -not -path "*api*" \
  | sed 's|src/app||;s|/page.tsx||;s|/(main)||;s|/(auth)||;s|/\[[a-z]*\]|/:id|g' \
  | sort -u > /tmp/pages_exist.txt
comm -23 <(grep -vE "^/api/|/uploads/|^/#" /tmp/all_hrefs.txt) /tmp/pages_exist.txt
# → 0

# 2-3. href="#" + handlers vides (couvert par R18)
grep -rn 'href="#"' src/app src/components  # → 0

# 4. Boutons sans handler ni Link (analyse contextuelle Python)
# → 0

# 5. Composants inutilisés
# ui/modal ui/skeleton ui/image-uploader supprimés
# price-alerts-section branché dans /mes-favoris
# → 0

# 6. Forms sans onSubmit/method/action
grep -rn "<form\b" src/app | grep -vE "onSubmit|method=|action="  # → 0
```

## Étape suivante

Rien de bloquant restant. Toute future soumission R18+R19 bloque
les nouvelles régressions de liens/handlers morts.
