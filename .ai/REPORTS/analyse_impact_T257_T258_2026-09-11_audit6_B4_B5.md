# Analyse d'impact — T-257 / T-258 (audit n°6, lot B : B4 + B5)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **HEAD de l'analyse** : `11165d4`
- **Nature** : analyse d'impact **avant/avec implémentation** (§14) — les deux correctifs sont additifs
  et n'exposent aucun nouveau contrat d'API.
- **Niveau de proportionnalité déclaré pour la tâche courante** : **S** (correctif de fin de parcours
  sur des pages existantes ; aucune migration, aucun changement de schéma, aucune route d'API modifiée).
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.4 (B4) et § 3.5 (B5)
- **Rapport de validation** : `.ai/REPORTS/validation_T257_T258_2026-09-11_audit6_B4_B5.md`

---

## 1. Surfaces touchées (mesuré, pas de mémoire)

| Fichier | Nature | Rôle |
|---|---|---|
| `src/app/dashboard/rooms/page.tsx` | modifié | branche hôte : **une** jointure `rooms ⋈ properties` + `countRooms()` + fenêtre |
| `src/app/dashboard/messages/page.tsx` | modifié | `conversationScope()` partagé liste/compteur + fenêtre |
| `src/app/(main)/hebergement/[slug]/page.tsx` | modifié | compteur + lien « Voir les N avis » ; bloc d'avis délégué au composant partagé |
| `src/components/property-reviews-list.tsx` | **créé** | rendu d'un avis partagé fiche ↔ page dédiée |
| `src/app/(main)/hebergement/[slug]/avis/page.tsx` | **créé** | page « tous les avis » (20/page, `?page=`) |
| `src/lib/ui-strings.ts` (+ test) | modifié | +3 clés FR/EN, verrou 1739 → 1742 |
| `src/app/dashboard/list-window.t257.test.ts` | **créé** | test RSC sur base réelle (3 cas) |
| `src/app/(main)/hebergement/reviews-page.t258.test.ts` | **créé** | test RSC sur base réelle (3 cas) |

Commandes utilisées :

```bash
grep -rln "parsePageWindow" src/app --include=page.tsx      # 9 écrans (7 + rooms + messages)
grep -rn '"/dashboard/rooms"\|"/dashboard/messages"' src --include=*.tsx
grep -rln "dashboard/rooms\|dashboard/messages" src --include=*.test.ts
grep -n "limit(5)" "src/app/(main)/hebergement/[slug]/page.tsx"
grep -rn '"property.reviews"' src --include=*.ts --include=*.tsx   # 0 appelant hors ui-strings
```

## 2. Appelants directs et indirects

1. **`/dashboard/rooms`** — liens de navigation (`src/components/layout/dashboard-sidebar.tsx:49,62`,
   `src/components/layout/dashboard-mobile-header.tsx:37,52`), redirection de `new-room-form.tsx:77`
   après création, redirection `/dashboard/rooms/<id>` → `/calendrier`, et le lien « Modifier l'unité »
   de la fiche de chambre. **Tous consomment la même liste** : la forme des `RoomRow` est inchangée
   (`id`, `propertyId`, `propertyName`, `name`, `roomType`, `maxOccupancy`, `quantity`, `sizeSqm`,
   `basePrice`, `currency`, `isActive`, `createdAt`), donc `RoomsManager` (filtres, tri par colonnes,
   sélection multiple, suppression) n'a pas été touché.
2. **`/dashboard/messages`** — liens de navigation (desktop + mobile) ; `MessagesManager` reçoit le même
   type `ConversationRow`. Le compteur d'onglet vient de `conversations_unread` (RSC layout), pas de
   cette liste : il n'est pas affecté par la fenêtre.
3. **`/hebergement/[slug]`** — appelée par la recherche, l'accueil (« populaires »), les cartes de
   wishlist, le sitemap et les e-mails (`appBaseUrl()` + `/hebergement/<slug>`). Le **balisage** de la
   fiche ne change qu'à deux endroits (en-tête « Avis vérifiés ✓ » et bouton « Voir les N avis ») ;
   le `JSON-LD` (`aggregateRating.reviewCount`) lisait déjà `property.totalReviews` et n'est pas touché.
4. **`/hebergement/[slug]/avis`** — aucun appelant antérieur ; le seul lien entrant est le bouton
   ajouté sur la fiche. Le sitemap ne la liste pas (volontaire : c'est une page de lecture paginée).

## 3. Tests existants couvrant déjà la surface

- `src/app/api/conversations/route.test.ts` et `src/app/api/messages/route.test.ts` : périmètre et
  cloisonnement de la messagerie (le filtrage repris dans `conversationScope()`).
- `src/lib/page-window.test.ts` : bornes du helper (25 / +25 / 500) — réutilisé tel quel.
- `src/lib/ui-strings.test.ts` : parité FR/EN + verrou du nombre de clés.
- Tests de composants/filtres : `messages-manager`, `rooms-manager` (filtres client, sélection).

## 4. Risques de régression identifiés et traités

| Risque | Traitement |
|---|---|
| **Ordre d'affichage des chambres côté hôte** : l'ancienne boucle groupait par bien (chacun trié `created_at desc`) ; la jointure trie **globalement** `created_at desc` | Changement **documenté et assumé** (l'audit le demandait explicitement : « mêmes champs, même tri `createdAt desc` ») ; il rend la fenêtre cohérente (un ordre groupé + `limit` aurait tronqué par bien) et l'affichage déterministe ; `RoomsManager` n'a pas de tri par défaut et affiche la colonne « Hébergement », donc le regroupement n'était pas signifiant |
| **Fenêtre sur un écran filtré côté client** : un utilisateur peut croire à une recherche exhaustive | Le bandeau `ShowMore` (déjà utilisé par 7 écrans) affiche « N résultats affichés sur M » + « Afficher 25 de plus » + note de périmètre ; aucun `?page=` n'est introduit (les filtres restent client) |
| **Fiche publique** : coût de requête, ordre, cache | La requête de la fiche est **inchangée** (`limit(5)`, `created_at desc`, cache TTL 60 s) ; seule l'extraction du rendu dans `PropertyReviewsList` change le fichier, pas la sortie HTML |
| **Page d'avis : contenu visible par erreur** | La page reprend `getPropertyForReviews` (bien `active` + hôte actif, exception hôte propriétaire/admin) : mêmes règles que la fiche, slug inconnu → **404** |
| **i18n** | 3 clés ajoutées FR **et** EN dans le même commit, verrou `ui-strings.test.ts` mis à jour (1739 → 1742) ; `property.reviews` réutilisée au lieu d'en créer une 4ᵉ |
| **Harnais de test** | Les pages concernées embarquent des composants clients : `next/navigation` et `@/components/ui/toast` sont mockés (pas de dépendance à l'App Router hors Next) ; les fixtures posent un `created_at` explicite pour rendre la pagination déterministe |

## 5. Effets attendus et revérification

- **Attendu** : `rooms` et `messages` ne dépassent jamais 25 lignes au premier chargement (hors
  `?limit=`), avec un bandeau exact ; un bien à plus de 5 avis expose un compteur et un lien vers la
  page complète, paginée 20 par 20.
- **Revérifié** : `tsc --noEmit` 0 ; `eslint src --max-warnings 0` 0/0 ; `list-window.t257.test.ts`
  3/3 ; `reviews-page.t258.test.ts` 3/3 ; `ui-strings.test.ts` 7/7 ; `npm run ci` complète (voir le
  rapport de validation).
- **Non touché (garanti)** : aucune route `src/app/api/**`, aucune migration, `src/db/schema.ts`
  intact, `parsePageWindow`/`ShowMore` non modifiés, autres écrans de liste inchangés.
