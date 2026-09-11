# Analyse d'impact — T-235 → T-239 (audit n°3, findings F4 → F8)

- **Date** : 2026-09-11
- **Source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md` (F4, F5, F6, F7, F8)
- **Périmètre** : cinq correctifs indépendants, chacun sans migration destructive, sans
  changement de contrat d'API public existant et sans toucher au tunnel de paiement.
- **Niveau de proportionnalité** : S (agrégat de 4 × S + 1 × XS)

## 1. Surfaces touchées

| Zone | Fichiers | Nature du changement |
|---|---|---|
| Réservation publique (F4) | `src/app/api/bookings/route.ts`, `src/lib/rate-limit.ts`, `src/lib/api-error.ts` | ajout d'un garde-fou 60/h **avant** lecture du corps, déplacement du quota produit 10/h **après** validation, cookie `mbb_guest`, message 429 avec délai |
| Réservation — données (F5) | `src/app/api/bookings/route.ts`, `src/app/dashboard/bookings/[id]/page.tsx`, `src/app/(main)/mes-reservations/page.tsx`, `src/lib/mail/templates.ts`, `src/lib/mail/strings.ts`, `src/lib/booking-request-notification.ts`, `src/lib/booking-confirmation.ts` | validation `HH:MM` et restitution de `estimatedArrival` (écrans + 4 e-mails) |
| Annonces (F6) | `src/app/api/properties/[id]/validate/route.ts`, `src/lib/mail/templates.ts`, `src/lib/settings.ts`, `src/components/admin/settings-panel.tsx`, `src/db/schema.ts`, `drizzle/0022_*.sql`, `src/app/dashboard/properties/[id]/{page,property-edit-client}.tsx` | colonne additive `properties.review_reason`, notification hôte idempotente, interrupteurs admin, affichage du motif |
| Wishlists (F7) | `src/app/(main)/wishlists/share/[token]/page.tsx`, `src/components/wishlist-actions.tsx` | `noindex`/`nofollow`, notice de partage, infobulle de rotation |
| Désabonnement (F8) | `src/lib/unsubscribe.ts` (nouveau), `src/app/(main)/desabonnement/page.tsx` (nouveau), `src/app/api/cron/price-alerts/route.ts`, `src/app/(main)/confidentialite/page.tsx`, `src/lib/ui-strings.ts` | jeton HMAC + page publique d'opposition + pied d'e-mail sur les alertes prix |

## 2. Risques identifiés et parades

| Risque | Probabilité | Parade retenue |
|---|---|---|
| Le garde-fou 60/h bloque un usage légitime (kiosque, IP partagée) | moyenne | La clé invité est un **cookie** (`mbb_guest`), pas l'IP seule : deux visiteurs derrière la même IP ne se pénalisent plus. L'IP ne sert que de repli si le cookie ne peut pas être posé. |
| Une saisie invalide consomme encore le quota produit | faible | Deux compteurs : `...:guard` (60/h, avant corps) et `...:user:<id>` / invité (10/h, après validation). Test dédié : 10 essais invalides → la demande valide suivante passe en **201**. |
| Le cookie invité casse une réservation si l'API cookie échoue | faible | `withGuestQuotaCookie` est en `try/catch` et en optional chaining : un cookie de quota ne doit **jamais** faire échouer une réservation (régression `route.t206` surveillée). |
| `estimatedArrival` hors format casse la colonne `time` | — (corrigé) | Validation `HH:MM` à l'entrée ; les valeurs déjà stockées sont restituées via `slice(0,5)`. |
| Fuite d'information via la notification de décision d'annonce | faible | `notifyHostOfDecision` est un envoi best-effort, idempotent (`eventKey` déterministe), silencieux si l'interrupteur est coupé ou s'il n'y a pas de changement d'état ; le motif reste **interne** (absent de `public-property`). |
| Double envoi lors d'un rejeu de décision admin | faible | `eventKey = property-decision:<propertyId>:<action>:<status>:<adminId>` — un rejeu ne crée pas de second e-mail (test 3/3). |
| Un jeton de désabonnement forgé désinscrit un tiers | faible | HMAC-SHA256 sur `userId|catégorie`, comparaison `timingSafeEqual`, message générique si invalide (aucune révélation d'existence de compte), catégorie **whitelistée**. |
| Nouvelle page publique non indexée / oubli de `noindex` | faible | `generateMetadata` de `/desabonnement` déclare `robots: { index: false, follow: false }` et le test le vérifie explicitement. |

## 3. Non-régression

- **Aucun contrat d'API supprimé.** Le tunnel de réservation conserve ses codes (201/400/409) ;
  seul un cas nouveau (429) apparaît, avec `Retry-After` et message localisé.
- **Migration strictement additive** : `ALTER TABLE ... ADD COLUMN IF NOT EXISTS review_reason
  varchar(500)` — `npm run db:push` l'applique, aucune donnée réécrite, aucun `NOT NULL` ajouté.
- **E-mails transactionnels inchangés** dans leur logique : les 4 gabarits de réservation gagnent
  une ligne conditionnelle (absente quand `estimatedArrival` n'est pas renseignée) — testé.
- **i18n FR/EN complet** : chaque libellé ajouté existe dans les deux langues (verrou passé de
  1645 à 1655 clés, test FR=EN vert).
- **Suite complète** : `npm run ci` verte — typecheck 0, lint 0/0, i18n 0 candidat, **vitest 127
  fichiers / 735 tests**, build, **smoke 95/95**, `ai:check` 19 OK / 1 warn (R7 attendu, resync
  `STATE.md` en fin de session) / 0 fail.

## 4. Ce qui n'est volontairement pas fait

- **Pas de table `user_notification_prefs`** : une seule catégorie non transactionnelle existe
  aujourd'hui (alertes prix). Le registre `UNSUBSCRIBE_CATEGORIES` est le point d'extension ;
  créer un schéma pour une valeur unique aurait été spéculatif (documenté dans
  `KNOWN_LIMITATIONS.md`).
- **Compteurs de quota toujours process-locaux** : limite multi-instance connue et documentée
  (T-009/T-235), remplacement par Redis hors périmètre.
