# Analyse de conception — T-261 (B9)

- **Date** : 2026-09-11 · **Tâches courantes** : T-261 · **Niveau** : S
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.9

## 1. Problème

L'écran « Préférences de notification » de `/mon-compte`
(`components/notification-prefs-section.tsx`) n'expose que `priceAlertEnabled` et
documente lui-même l'absence de préférences par utilisateur : les onze autres
interrupteurs sont des réglages **globaux d'administration**
(`app_settings.notifications`, écran `/dashboard/settings`). Un voyageur ne peut donc
pas arrêter ses rappels de séjour ni ses demandes d'avis — il ne lui reste que le
signalement en spam, qui dégrade la délivrabilité pour tout le monde. L'audit a
également vérifié que les 12 clés sont bien lues par le code d'envoi (aucun
interrupteur mort) et que seul `newsletter` n'est pas branché.

## 2. Options

| Sujet | Option | Verdict |
|---|---|---|
| Stockage | table `user_notification_prefs` dédiée | **Écartée** : une ligne par utilisateur × par clé pour trois catégories, et une jointure de plus à chaque envoi |
| | colonne `users.notification_prefs` jsonb **nullable** | **Retenue** : additive, `null` = héritage, aucune migration de données |
| Sémantique | préférence prioritaire sur le global | **Écartée** : un utilisateur pourrait réactiver un e-mail que l'équipe a coupé (spam, incident) |
| | global **maître**, l'utilisateur ne peut que restreindre | **Retenue** : préserve la main de l'équipe, principe de moindre surprise |
| Périmètre | les 11 interrupteurs réglables | **Écartée** : un utilisateur pourrait couper la confirmation de réservation ou une alerte de sécurité |
| | 3 catégories « confort » (rappels, demandes d'avis, décisions de modération) | **Retenue** : conforme à l'audit et à la page Confidentialité |
| Granularité | 6 interrupteurs (une clé = une case) | **Écartée** : l'utilisateur ne distingue pas J-3 de J-1 ; surcharge visuelle |
| | 3 cases, chacune couvrant ses clés | **Retenue** : lisible, et le mapping est testé |
| Écriture | `PUT` d'un objet complet | **Retenue** : `PATCH /api/users/me` avec `notificationPrefs` strict ; `null` efface et redonne l'héritage |

## 3. Conception retenue

- **Catégories** : `stayReminders` (J-3, J-1), `reviewRequests` (demande d'avis),
  `moderationDecisions` (avis modéré, annonce validée/refusée).
- **Helper pur** `src/lib/notification-prefs.ts` : `categoryForNotificationKey`,
  `parseUserNotificationPrefs` (tolérant, ne lève jamais), `enabledFor(prefs, key, global)`
  (= `global && (prefs[catégorie] !== false)`), `isCategoryDisabled`.
- **Points d'envoi** : `sendBookingReminders` et `sendReviewRequests` sélectionnent
  `users.notification_prefs` avec la ligne du voyageur ; `notifyReviewModerated` avec
  l'auteur ; `notifyHostOfDecision` avec l'hôte. La coupure a lieu **avant** l'écriture
  de l'`eventKey` (idempotence : rien n'est « consommé » pour un envoi supprimé).
- **Écran** : trois cases + la note (clé `notif.globalNote` réécrite) qui dit que les
  e-mails transactionnels restent envoyés par l'équipe ; l'enregistrement écrit l'état
  affiché (objet complet) en plus de `priceAlertEnabled`.
- **API** : `PATCH /api/users/me` (objet strict, `null` accepté) et `GET /api/auth/me`
  (champ additif normalisé) — l'UI confirme sans recharger, comme pour les alertes prix.

## 4. Limites assumées

- Trois cases seulement : un utilisateur ne peut pas couper un seul niveau de rappel
  (J-3 ou J-1) — c'est un choix de lisibilité, documenté.
- Les e-mails transactionnels restent non désactivables (exécution du contrat,
  sécurité) : la page Confidentialité et la note de l'écran le disent.
- Aucune préférence marketing supplémentaire : le registre `UNSUBSCRIBE_CATEGORIES`
  reste le point d'extension si une catégorie marketing apparaît.
