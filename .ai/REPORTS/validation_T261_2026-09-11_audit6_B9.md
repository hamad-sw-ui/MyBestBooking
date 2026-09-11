# Validation — T-261 (B9 : préférences de notification par utilisateur)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : `users.notification_prefs` (jsonb nullable), helper `enabledFor`,
  écran de préférences étendu, application aux rappels de séjour, demandes d'avis et
  décisions de modération — constat B9 de l'audit n°6.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.9

## 1. Livré

| Élément | État |
|---|---|
| Colonne `users.notification_prefs` (jsonb, nullable, additif) | ✅ migration `0025_user_notification_prefs.sql` + `db:push` ; `NULL` = héritage du global |
| Helper pur `src/lib/notification-prefs.ts` | ✅ 3 catégories, mapping de 6 clés, lecture défensive, `enabledFor` (global **maître**) |
| Rappels de séjour (J-3 / J-1) | ✅ préférence par voyageur ; coupure avant l'`eventKey` |
| Demandes d'avis | ✅ idem (réactivable dans la fenêtre de 14 jours) |
| Décisions de modération (avis modéré, annonce validée/refusée) | ✅ préférence de l'auteur / de l'hôte |
| Écran `/mon-compte` | ✅ 3 cases + note « e-mails transactionnels » (clé réécrite FR/EN) |
| API | ✅ `PATCH /api/users/me` (objet strict, `null` = effacer) ; `GET /api/auth/me` expose le réglage normalisé |
| i18n | +6 clés FR/EN, verrou **1762 → 1768** ; aucune clé orpheline (`notif.globalNote` réutilisée et réécrite) |

## 2. Preuves automatisées

- `src/lib/notification-prefs.test.ts` **10/10** : mapping clé→catégorie sans collision,
  envois transactionnels hors périmètre, lecture défensive (null, chaîne malformée, objet
  partiel), `enabledFor` (global coupé jamais réactivé ; `null` = héritage ; une catégorie
  coupée n'affecte pas les autres).
- `src/app/api/users/me/route.t261.test.ts` **5/5** (base réelle) : PATCH persiste et
  renvoie l'objet normalisé ; `GET /api/auth/me` l'expose ; clé inconnue → **400** ;
  PATCH sans préférences → réglage intact ; `notificationPrefs: null` → colonne NULL.
- `src/lib/booking-lifecycle-emails.t261.test.ts` **2/2** (base réelle) : compte
  `stayReminders:false` → **aucune** ligne d'outbox `booking-reminder:<id>:j3` ;
  compte hérité → ligne présente ; idem `review-request:<id>`.
- `src/components/notification-prefs-section.test.tsx` **2/2** : trois catégories + note,
  quatre interrupteurs, état « hérité » coché par défaut, case décochée quand la
  catégorie est coupée.
- `npx tsc --noEmit` 0 · `npx eslint . --max-warnings 0` 0/0 · vitest complet (voir commit).

## 3. Sonde runtime (dev :3000, compte `customer@`)

| Étape | Résultat |
|---|---|
| `GET /api/auth/me` avant | `notificationPrefs: null` (héritage) |
| `PATCH {"notificationPrefs":{"stayReminders":false,"reviewRequests":true,"moderationDecisions":false}}` | **200**, écho identique |
| `GET /api/auth/me` après | `{stayReminders:false, reviewRequests:true, moderationDecisions:false}` |
| `PATCH` avec clé inconnue `bonus` | **400** — `{"error":"Unrecognized key: \"bonus\"","issues":[{"field":"bonus",…}]}` |
| `PATCH {"notificationPrefs":null}` | **200**, `GET` → `null` (compte remis à l'état seed) |

## 4. Portée

Le comportement d'envoi est **inchangé** pour tout compte n'ayant jamais touché l'écran
(`NULL` ⇒ global). L'équipe conserve la main : une préférence utilisateur ne peut que
restreindre. Les e-mails transactionnels et de sécurité restent non désactivables.
