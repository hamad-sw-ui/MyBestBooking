# Analyse d'impact — T-241 (audit n°3 : F11 + F12 + F13)

- **Date** : 2026-09-11
- **Source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md`
- **Nature** : finitions — aucune migration, aucun nouveau flux métier, contrat d'API
  **étendu** (jamais restreint sur un appel légitime).

## 1. Surfaces touchées

| Volet | Fichiers | Nature |
|---|---|---|
| (a) F11 — « supprimé » vs « suspendu » | *(aucun)* | déjà livré par T-230 : `suspended_at` et `deleted_at` sont deux colonnes distinctes, `users-manager` transmet `deleted` à `UserSuspendActions`, qui affiche « Compte anonymisé — non réactivable » au lieu du bouton **Réactiver** |
| (b) F12 — période + export | `src/lib/analytics-period.ts` (nouveau, 8 exports), `src/lib/analytics.ts` (extrait de la page), `src/app/dashboard/analytics/page.tsx` (réécrit en affichage), `src/app/api/dashboard/analytics/export/route.ts` (nouveau), `src/lib/ui-strings.ts` (+27 clés FR/EN) | sélecteur `?from&to`, export CSV localisé, agrégats partagés entre l'écran et l'export |
| (c) F13 — erreurs d'API | `src/lib/http.ts` (`zodIssues`, `zodErrorResponse`), 20 routes `src/app/api/**` | réponse 400 `{ error, issues[] }` traduite ; schémas de mutation `.strict()` |

## 2. Risques et parades

| Risque | Parade |
|---|---|
| Un client existant lit `error` et casserait si la forme changeait | `error` conserve **exactement** sa valeur (première erreur, en français) et sa position ; `issues` est un champ **additif** |
| Régression T-159 (« les issues Zod en anglais fuyaient ») | `zodIssues` passe chaque libellé par la même traduction que `frenchZodMessage` ; le test de la route settings, réécrit, refuse explicitement `Invalid`/`Expected`/`Required`/`Unrecognized` |
| Un client envoie un champ inconnu légitime | Choix assumé et limité : `.strict()` posé uniquement sur `PUT /api/bookings/[id]`, `PATCH /api/users/me`, `POST/PATCH /api/wishlists`, `POST /api/messages`, `POST /api/conversations`, `POST /api/reviews`, `PUT /api/rooms/[id]/availability`, `POST/PATCH /api/rooms/[id]/rate-plans` — les champs réellement envoyés par l'UI ont été vérifiés un par un avant de les passer en strict |
| Le sélecteur de période change les chiffres par défaut | `parseAnalyticsPeriod` sans paramètre rend **exactement** la fenêtre historique (30 jours + comparaison 30-60 jours), testé sur des dates fixes |
| Décalage de fuseau sur la période | bornes **civiles** `YYYY-MM-DD`, arithmétique UTC (`shiftCivilDays`), testée sur les changements d'heure européens et les années bissextiles (T-232) |
| Période abusive (10 ans) coûteuse | étendue bornée à 366 jours (la borne avance `from`, l'intention reste lisible) ; fin future ramenée à aujourd'hui |
| Export CSV interprété comme document comptable | en-tête de fichier daté, libellé « export opérationnel » aligné sur les deux exports existants, montants **jamais** additionnés entre devises |
| Injection de formule Excel via un nom d'hébergement | `csvCell` préfixe `=`, `+`, `-`, `@` par une apostrophe (règle déjà appliquée aux exports factures/versements) |

## 3. Non-régression

- Les agrégats sont **identiques** à ceux d'avant l'extraction : même règles de calcul
  (devise dominante, panier moyen par devise, occupation sur les nuits réellement situées dans
  la fenêtre, avis approuvés seulement). Le seul changement volontaire est le **top hébergements**,
  désormais calculé sur la période analysée (avant : sur tout l'historique, incohérent avec un
  sélecteur).
- La série journalière affiche au plus 31 jours (comportement visuel inchangé) ; l'export, lui,
  reste exhaustif sur la période.
- `npm run ci` verte : typecheck 0 · lint 0 · i18n 0 candidat · **vitest 129 fichiers / 743 tests**
  · build · **smoke 95/95** · `ai:check` 19 OK / 1 warn (R7) / 0 fail.
