# 🎯 TÂCHE EN COURS

**ID** : T-151

**Niveau de proportionnalité** : L

**Titre** : Localisation de l'e-mail de vérification à l'inscription (langue
choisie à l'inscription + checkout invité).

**Statut** : CORRIGÉ (VALIDÉ)

Rapport : `REPORTS/validation_T-151_2026-08-30.md` (+ audit fonctionnel n°24
`REPORTS/audit_fonctionnel_profond24_2026-08-30.md`).

## Résumé
- 🔨 `POST /api/auth/register` accepte `language` (fr/en/ar, défaut fr),
  le persiste sur `users.language` et le renvoie → l'**e-mail de
  vérification** est localisé pour le destinataire dès l'inscription.
- 🔨 Checkout **invité** : `POST /api/bookings` accepte `language` et le
  persiste sur le profil invité → l'e-mail de **réclamation de compte** est
  localisé (prouvé à l'exécution avec `language=en`).
- 🔨 Formulaires (inscription, réservation) envoient la langue d'interface
  résolue (`useDisplayPreferences`), sans casser les appels sans champ.

## Validation
🧪 **tsc 0 · lint 0 erreur (14 warnings préexistants, 0 sur fichiers
modifiés) · vitest 316/316 (+4 : 2 unitaires mail, 2 intégration register) ·
smoke 94/94 · build OK** · preuve runtime HTTP : guest `language=en` →
profil `en`, e-mail « Access your booking … » / « Activate my access ».
Données de test nettoyées (8 users, 32 réservations seed, outbox 0,
wishlist seed restaurée).

## Audit fonctionnel n°24 (à l'exécution)
🔍 41 pages / 61 routes API crawlees (anonyme/client/hôte/admin) : RBAC et
routes saines ; **5 findings** documentés avec solutions sans régression —
A **pending** (payer/annuler inaccessibles, API déjà prête) · B devise « € »
codée en dur dans /reservation · C totaux analytics/billing sans devise
explicite · D i18n partiel (20/113 composants, `lang="fr"` figé, aucun
sélecteur) · E avis « doublon » (CTA toujours visible après dépôt).
**Aucune modification de code pour ces 5 findings** (rapport + solutions ;
implémentation sur demande).

## Reste / limites
Sélecteur de langue UI absent (voir finding D) ; sujets/corps admin des
e-mails non traduits (compromis T-025, inchangé).
