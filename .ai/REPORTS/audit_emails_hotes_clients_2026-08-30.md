# Audit — E-mails de notification entre hôtes et clients

**Date :** 2026-08-30
**Branche :** `arena/01a052ed-mybestbooking` (base `2d8c885` — T-149)
**Type :** audit de lecture du code (aucun changement de code)
**Question posée :** *« est-ce que les messages par mail sont aussi bien gérés
pour les hôtes et leurs clients ? »*
**Réponse courte :** ✅ largement oui (bidirectionnel, localisé selon le
destinataire), mais **3 écarts réels** subsistent — documentés ici comme
limites assumées, sans correction de code (décision utilisateur).

---

## 1. Périmètre vérifié

- Déclencheurs d'e-mails : `src/app/api/messages/route.ts`,
  `src/lib/booking-confirmation.ts`, `src/lib/booking-cancellation.ts`,
  `src/lib/booking-lifecycle-emails.ts`, `src/app/api/cron/price-alerts/route.ts`,
  `src/app/api/auth/{register,verify,forgot-password,resend-verification}/route.ts`,
  `src/app/api/bookings/route.ts` (claim invité).
- Gabarits : `src/lib/mail/templates.ts`, `src/lib/mail/strings.ts`,
  `src/lib/settings.ts` (bloc `emailTemplates`).
- Envoi : `src/lib/email-outbox.ts` (outbox idempotente, retries, mailer).
- Tests : `src/lib/mail/index.test.ts`.

---

## 2. Ce qui est bien géré ✅

| Événement | Voyageur | Hôte | Langue = destinataire ? |
|---|---|---|---|
| Nouveau message (v→h **et** h→v) | ✅ | ✅ | ✅ habillage (⚠️ §3.1/3.2) |
| Confirmation de réservation | ✅ (`…:guest`) | ✅ (`…:host`) | ✅ chacun la sienne |
| Annulation de réservation | ✅ | ❌ (voir §3.3) | ✅ (voyageur) |
| Rappel J-3 / J-1 | ✅ | — | ✅ |
| Demande d'avis post-séjour | ✅ | — | ✅ |
| Alerte prix | ✅ | — | ✅ (corps plateforme localisé) |
| Bienvenue / vérification / reset mdp / claim invité | ✅ | — | ✅ |

Points forts du mécanisme `newMessage` (`src/app/api/messages/route.ts`, ~l.140) :

- **Bidirectionnel vérifié** : si l'expéditeur est le voyageur, le
  destinataire est l'hôte (`convWithProperty.hostId`) ; si l'expéditeur est
  l'hôte, le destinataire est le voyageur (`convWithProperty.userId`).
- **Langue du destinataire** lue depuis `users.language` et passée au
  template (`recipient.language ?? null`).
- **Robustesse** : envoi hors transaction en `try/catch` (best-effort, la
  réponse API n'échoue jamais pour un e-mail), `eventKey` déterministe
  (`message:{msg.id}:{recipientId}`) → aucune duplication via l'outbox,
  rate-limit 60/h par utilisateur, pièces jointes contrôlées (MIME serveur).
- `bookingHostNotification` (`templates.ts`) : tableau récapitulatif +
  mention « Consultez le détail dans votre **tableau de bord** » (lien
  `/dashboard/bookings`), localisés fr/en.

---

## 3. Les 3 écarts réels (limites assumées, non corrigées)

### 3.1 — `newMessage` : aucun lien/bouton vers la conversation

Signatures du template (`templates.ts`) :

```ts
async newMessage({ firstName, senderName, language }) { ... }
```

Aucune URL n'est passée : le corps par défaut
(`src/lib/settings.ts` ~l.311) dit simplement « Connectez-vous pour y
répondre », **sans CTA ni lien profond**. Le destinataire (hôte ou client)
doit retrouver sa conversation seul dans l'application
(`/messages` côté voyageur, `/dashboard/messages` côté hôte).

### 3.2 — `newMessage` : sujet + corps restent en français pour un anglophone

Le sujet (« Nouveau message de {senderName} ») et le corps (« Vous avez reçu
un nouveau message… Connectez-vous pour y répondre. ») proviennent du bloc
admin `emailTemplates` et sont rendus tels quels, contrairement à
`priceAlert` / `guestAccountClaim` dont le sujet et le corps sont gérés par
la plateforme et localisés fr/en.

Conséquence : un destinataire anglophone reçoit **l'habillage en anglais**
(slogan « Book better. Travel further. ») mais un **sujet et un corps en
français**. C'est le compromis T-149 documenté (contenu admin-éditable non
traduit automatiquement), mais ici le texte est un texte **générique
plateforme** (pas un contenu éditorial d'hébergement) — il serait légitime de
le localiser comme l'alerte prix.

### 3.3 — Aucun e-mail à l'hôte lors d'une annulation

`notifyBookingCancellation` (`src/lib/booking-cancellation.ts` ~l.76)
n'enfile qu'un e-mail vers `outcome.booking.guestEmail`. Que l'annulation
vienne du client, de l'hôte ou de l'admin (`/api/bookings/[id]` et
`/api/admin/bulk`), l'hôte n'est **jamais notifié par e-mail** — il ne le
voit que dans son dashboard. Aucun template `hostCancellation` n'existe.

### 3.4 — Tests absents (mentionné pour information)

`src/lib/mail/index.test.ts` ne couvre **ni `newMessage` ni
`bookingHostNotification`** : la localisation de la notification hôte et du
messaging n'est pas régressée par un test.

---

## 4. Recommandation (si évolution souhaitée plus tard)

1. `newMessage` (A) : ajouter `url` + rôle du destinataire au template,
   bouton CTA localisé (« Répondre / Reply », `/messages` ou
   `/dashboard/messages`) — l'appel connaît déjà `recipientId` ;
2. `newMessage` (B) : sujet + corps gérés plateforme et localisés fr/en
   (comme `priceAlert`) ;
3. Annulation (C) : e-mail `hostCancellation` en langue de l'hôte via
   l'outbox (`eventKey` déterministe) ;
4. Tests fr/en pour `newMessage`, `bookingHostNotification` et l'annulation
   hôte.

*Décision initiale du 2026-08-30 : rapport uniquement. **Mise à jour** :
l'utilisateur a ensuite demandé l'implémentation conforme au framework — voir
§5.*

---

## 5. RÉSOLUTION — T-150 (2026-08-30)

Les 3 remarques ont été implémentées (décision utilisateur) :

1. **CTA `newMessage`** — le template reçoit désormais `url` ; bouton
   « Répondre au message / Reply to the message » pointant vers
   `/messages/{id}` (voyageur) ou `/dashboard/messages/{id}` (hôte),
   construit dans `POST /api/messages` selon le rôle du **destinataire**.
2. **Localisation sujet + corps `newMessage`** — contenu plateforme fr/en
   dans la langue du destinataire ; la surcharge admin reste respectée
   (comparaison aux DEFAULTS) et le CTA plateforme est toujours ajouté.
3. **E-mail d'annulation à l'hôte** — nouveau template
   `bookingHostCancellation` (contenu plateforme, fr/en selon l'hôte,
   tableau + motif + CTA dashboard), câblé dans `notifyBookingCancellation`
   via l'outbox (`eventKey` déterministe, best-effort). L'e-mail voyageur
   est inchangé.
4. **Tests** — +13 (10 unitaires : `newMessage` fr/en, override admin,
   anti-XSS, `bookingHostNotification` fr/en, `bookingHostCancellation`
   fr/en + XSS ; 3 intégration DB : notification d'annulation 2 e-mails,
   route messages 2 sens avec langue + CTA).

Validation : rapports `REPORTS/validation_T-150_2026-08-30.md` — tsc 0,
lint 0 erreur, **vitest 312/312**, smoke **94/94**, build OK, preuve runtime
HTTP (voyageur `language=en` → e-mail anglais + CTA `/messages/…` ; hôte →
FR + CTA `/dashboard/messages/…`).
