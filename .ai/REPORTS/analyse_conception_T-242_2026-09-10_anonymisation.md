# Analyse de conception — T-242 : anonymisation complète à la suppression de compte

- **Date** : 2026-09-10
- **Niveau** : **C (critique)** — données personnelles persistées.
- **Entrées** : constat N1 de `docs/analyse_2026-09-10_audit_runtime_profondeur.md`, analyse
  d'impact `REPORTS/analyse_impact_T-242_2026-09-10_anonymisation.md`.

## 1. Objectif

Faire en sorte qu'une demande de suppression de compte (« droit à l'effacement ») retire
l'identifiant personnel de l'utilisateur **partout** où il a été copié, tout en conservant les
enregistrements comptables exigés par la loi (montants, dates, référence de réservation) et la
traçabilité des actions d'administration.

## 2. Problème actuel

`DELETE /api/users/me` (route, `src/app/api/users/me/route.ts:154-183`) exécute une transaction qui
met à jour `users` (e-mail haché, nom/photo/téléphone effacés, 2FA purgée) et supprime les
sessions. Trois tables conservent l'identité :

- `bookings.guest_email / guest_first_name / guest_last_name` (copie figée à la réservation) ;
- `email_outbox.to` (une ligne par e-mail envoyé, adresse en clair) ;
- `audit_log.metadata.targetEmail` (écrit par `PATCH /api/users/[id]/suspend`, ligne 68).

Contraintes : l'opération doit rester **une seule transaction** (pas d'état intermédiaire où le
compte est anonymisé mais les copies visibles), ne doit **rien casser** des factures et exports
hébergeur (qui lisent `bookings.guest_*`), et ne doit pas modifier le contrat HTTP de la route.

## 3. Solutions possibles

### A. Anonymiser à la lecture (masquage applicatif)

Les requêtes qui lisent `bookings.guest_*`, `email_outbox.to` ou `audit_log.metadata` détectent
`users.deleted_at` et substituent « Supprimé Compte ».

- *Avantages* : aucune écriture, réversible, pas de migration.
- *Inconvénients* : il faut modifier **tous** les points de lecture (facture, e-mails, exports,
  audits, dashboards) ; un oubli = fuite silencieuse ; les données restent physiquement présentes
  (insuffisant vis-à-vis d'une demande d'effacement).
- *Complexité* : moyenne. *Sécurité* : faible (données conservées). *Maintenabilité* : fragile.

### B. Transactions `UPDATE` ciblées (effacement en place)

Dans la transaction existante, trois `UPDATE` supplémentaires : `bookings` de l'utilisateur,
`email_outbox` pour l'adresse concernée, `audit_log` (redaction JSON de `metadata->>'targetEmail'`).

- *Avantages* : données réellement effacées ; aucune dépendance à la discipline des lecteurs ;
  aucun changement de contrat public ; vérifiable par un test « 0 occurrence ».
- *Inconvénients* : écriture sur des tables volumineuses (`email_outbox`) — bornée par une adresse ;
  perte de l'information « nom du client » sur les factures antérieures (assumé : la facture reste
  légale, seul le nom d'affichage change).
- *Complexité* : faible. *Performance* : un UPDATE par table, index sur `to`/`user_id`.

### C. Pseudonymisation par table de correspondance

Créer `anonymization_map(id, target_table, target_id, original_value_hash)` et ne plus jamais
stocker l'original dans les tables métier (écriture à la source).

- *Avantages* : effet durable pour les **futures** copies (aucune récidive possible).
- *Inconvénients* : nouveau schéma + migration + reprise des données existantes ; complexité
  disproportionnée pour trois copies ; nécessite de modifier le tunnel de réservation (hors sujet
  ici) et de gérer la clé de correspondance elle-même comme une donnée sensible.
- *Complexité* : élevée. *Architecture* : structurante, à réserver à un futur chantier « privacy by
  design ».

### D. Ne rien faire (documenter la rétention)

- *Avantages* : zéro risque technique.
- *Inconvénients* : contredit la page Confidentialité et expose à un manquement RGPD.

## 4. Solution retenue

**B — transactions `UPDATE` ciblées**, exécutée dans la transaction d'anonymisation existante.
Raisons : c'est la seule solution qui **efface réellement** sans ajouter de schéma ni de dette de
lecture ; elle tient en trois requêtes indexées ; elle est directement testable par une assertion
« aucune occurrence de l'adresse d'origine ». C est retenue comme cible d'architecture à long
terme (à tracer en observation), A et D sont écartées pour insuffisance.

## 5. Risques

| Risque | Niveau | Mesure |
| --- | --- | --- |
| Facture antérieure rendue « illisible » | Faible | seuls le nom et l'e-mail changent ; référence, dates, montants, devise, commission intacts |
| Requête lourde sur `email_outbox` | Faible | périmètre = une adresse (unique), index implicite par volume faible |
| Oubli d'une nouvelle table à l'avenir | Moyen | le test d'intégration énumère les tables ; à compléter lors de toute nouvelle copie d'identité |
| Régression du refus 409 (réservation active) | Faible | chemin de refus inchangé, test T-206 existant conservé |

## 6. Compatibilité

- **API** : aucun changement de signature ni de code de statut (`{ deleted: true }`, 200).
- **Schéma** : aucune migration (seules des valeurs changent).
- **Données existantes** : les comptes déjà anonymisés **avant** ce correctif gardent leurs copies ;
  une passe de rattrapage (cron ponctuel ou commande documentée) est possible mais non incluse —
  à tracer en observation.
- **Utilisateurs** : impact visible seulement sur les écrans affichant une réservation d'un compte
  supprimé (nom → « Supprimé Compte »).
- **Performance** : négligeable (3 UPDATE dans une transaction déjà en cours).

## 7. Plan de développement (étapes validables)

1. Extraire la logique d'anonymisation dans `src/lib/account-anonymization.ts`
   (`anonymizeUserAccount(tx, user, anonymizedEmail)`) pour la rendre testable sans HTTP.
2. Y ajouter les trois `UPDATE` (bookings, email_outbox, audit_log) + constantes partagées
   (`ANONYMIZED_FIRST_NAME = "Supprimé"`, `ANONYMIZED_LAST_NAME = "Compte"`).
3. Brancher la route `DELETE /api/users/me` sur ce service (comportement HTTP inchangé).
4. Écrire le test d'intégration « 0 occurrence » (utilisateur + réservation + outbox + audit).
5. Vérifier la facture après anonymisation (200, montants intacts) + `npm run ci`.
6. Documenter dans `.ai/SECURITY.md` / `.ai/DATABASE.md` (rétention et champs neutralisés).

## 8. Plan de retour arrière

Le correctif n'introduit ni migration ni changement de contrat : un `git revert` du commit suffit.
Les données déjà effacées ne peuvent pas être restaurées (c'est l'objectif) — le rollback ne
concerne donc que le **code** ; aucune donnée n'est créée par l'aller-retour. En cas d'incident
sur un compte précis, seule une sauvegarde base antérieure permettrait de revenir en arrière,
décision qui appartient à l'exploitant.
