# 🎯 TÂCHE EN COURS

**ID** : T-150

**Niveau de proportionnalité** : L

**Titre** : E-mails hôtes ↔ clients — CTA messagerie, localisation fr/en du
nouveau message et notification d'annulation à l'hôte.

**Statut** : CORRIGÉ (VALIDÉ)

Rapport : `REPORTS/validation_T-150_2026-08-30.md` (+ audit source
`REPORTS/audit_emails_hotes_clients_2026-08-30.md`).

## Résumé
- 🔨 `newMessage` : CTA localisé vers la conversation (`/messages/…` pour le
  voyageur, `/dashboard/messages/…` pour l'hôte) ; sujet + corps plateforme
  localisés fr/en dans la langue du **destinataire** ; surcharge admin
  préservée (comparaison aux DEFAULTS).
- 🔨 Nouvel e-mail `bookingHostCancellation` (contenu plateforme localisé
  fr/en) : l'hôte est notifié à l'annulation via l'outbox (`eventKey`
  déterministe), best-effort, sans casser l'e-mail voyageur existant.
- 🔨 Métadonnées admin (`{url}` documenté) + 13 nouveaux tests (10 unitaires
  + 3 d'intégration DB).

## Validation
🧪 **tsc 0 · lint 0 erreur (14 warnings préexistants, 0 sur fichiers modifiés)
· vitest 312/312 (+13) · smoke 94/94 · build OK** · preuve runtime HTTP :
voyageur `language=en` reçoit « New message from… » + CTA `/messages/…` ;
hôte reçoit FR + CTA `/dashboard/messages/…` ; annulation → 2 e-mails
(voyageur FR, hôte **EN**). Données de test nettoyées (8 users, 32
réservations seed, outbox vide).

## Reste / limites
L'e-mail de **vérification à l'inscription** reste en FR par défaut
(register n'accepte pas `language` — préexistant, hors périmètre messaging) ;
corps éditables admin non traduits (compromis T-025, inchangé).
