# Analyse d'impact — T-261 (B9 : préférences de notification par utilisateur)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **BASE** : `04d906e`
- **Niveau** : S (une colonne additive, un écran, cinq points d'envoi).
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.9 (B9)
- **Rapport de validation** : `.ai/REPORTS/validation_T261_2026-09-11_audit6_B9.md`

## 1. Surfaces touchées

| Fichier | Nature | Rôle |
|---|---|---|
| `src/db/schema.ts` + `drizzle/0025_user_notification_prefs.sql` | modifiés | `users.notification_prefs` **jsonb nullable**, aucun défaut (migration additive + entrée de journal) |
| `src/lib/notification-prefs.ts` (+ `.test.ts`) | **créé** | catégories, lecture défensive du jsonb, `enabledFor` |
| `src/lib/booking-lifecycle-emails.ts` | modifié | rappels J-3/J-1 et demandes d'avis : préférence **par voyageur** |
| `src/lib/review-notifications.ts` | modifié | décision de modération : préférence de l'auteur |
| `src/app/api/properties/[id]/validate/route.ts` | modifié | décision d'annonce : préférence de l'hôte |
| `src/app/api/users/me/route.ts` | modifié | `PATCH` accepte `notificationPrefs` (objet strict, `null` = effacer) |
| `src/app/api/auth/me/route.ts` | modifié | expose les préférences normalisées (l'écran les lit là) |
| `src/components/notification-prefs-section.tsx` (+ test) | modifié | trois catégories réglables + note sur les e-mails transactionnels |
| `src/app/(main)/mon-compte/account-client.tsx` | modifié | type + prop `notificationPrefs` |
| `src/lib/ui-strings.ts` (+ verrou) | modifié | +6 clés FR/EN, verrou **1762 → 1768** |

## 2. Effets indirects

1. **Aucun envoi ne change pour un compte existant** : `notification_prefs` est NULL
   partout après migration, et `enabledFor(prefs=null, …)` renvoie le réglage global —
   comportement identique à l'instant d'avant.
2. **L'interrupteur admin reste maître** : `enabledFor` renvoie `false` si le global est
   coupé, même avec une préférence utilisateur à `true`. Un utilisateur ne peut donc
   jamais réactiver un type d'e-mail que l'équipe a désactivé.
3. **Périmètre volontairement limité** : seules trois catégories « confort » sont
   réglables (rappels de séjour, demandes d'avis, décisions de modération). Les e-mails
   transactionnels (vérification d'adresse, confirmation, expiration, relance de
   règlement, sécurité) et les alertes prix (réglage dédié déjà existant) ne bougent pas.
4. **Pas de nouvelle table** : une colonne jsonb sur `users` (le registre
   `UNSUBSCRIBE_CATEGORIES` reste le point d'extension marketing).
5. **Idempotence préservée** : la préférence coupe l'envoi **avant** l'écriture de
   l'`eventKey` — un utilisateur qui réactive sa catégorie dans la fenêtre de 14 jours
   peut donc encore recevoir sa demande d'avis (aucun « trou » définitif).
6. **Aucune API publique modifiée** : `GET /api/auth/me` gagne un champ additif,
   `PATCH /api/users/me` une clé optionnelle (schéma `.strict()` : une clé inconnue est
   refusée en 400 avec `issues`, comme le reste du dépôt).

## 3. Risques de régression et traitement

| Risque | Traitement |
|---|---|
| Un envoi cesse alors qu'il partait avant | Global maître + `null = héritage` + tests : compte hérité reçoit, compte réglé non |
| Préférence corrompue dans la colonne (valeur exotique) | `parseUserNotificationPrefs` ne retient que des booléens connus et ne lève jamais → héritage |
| L'utilisateur croit pouvoir couper la confirmation de réservation | La note de l'écran le dit explicitement (clé réécrite, FR/EN) |
| Migration sur base existante | `ADD COLUMN IF NOT EXISTS`, nullable, sans défaut — aucune réécriture de ligne |
| Fermeture de l'écran sur un compte qui n'a rien réglé | `null` conservé tant que l'utilisateur n'enregistre pas ; enregistrer écrit l'état affiché |

## 4. Revérification

`tsc` 0 · `eslint` 0/0 · tests ciblés **19/19** (dont preuve base réelle des deux envois)
· vitest complet · sonde runtime (PATCH/GET/400/reset) · `ai:check` · CI complète.
