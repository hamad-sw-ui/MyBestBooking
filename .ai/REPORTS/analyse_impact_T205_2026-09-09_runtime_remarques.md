# Analyse d’impact — T-205 — Mise en œuvre des remarques de l’audit fonctionnel/runtime

- **Date** : 2026-09-09
- **Niveau retenu** : S
- **Nature** : corrections fonctionnelles transverses sans migration de schéma
- **Principe directeur** : corrections additives, garde serveur conservée, source de vérité DB/API inchangée, UI alignée sur les contrats déjà présents.

## Périmètre impacté

| Zone | Problème runtime constaté | Impact utilisateur | Orientation de correction sans régression |
|---|---|---|---|
| Tunnel réservation | L’API sait créer une réservation manuelle par défaut et un paiement en ligne via `payOnline`, mais l’UI affiche toujours « paiement sécurisé » et n’envoie jamais le choix online. | Confusion : demande manuelle présentée comme paiement immédiat ; Stripe existant reste inaccessible depuis le tunnel. | Ajouter un choix explicite manuel/online, conserver manuel par défaut, n’appeler Stripe que si `payOnline:true`, garder la garde `shouldShowStripeForm`. |
| Wallet réservation | La ligne de réduction wallet ne s’affiche que si une promo est aussi appliquée. | Total final incohérent visuellement lorsque seul le wallet est utilisé. | Afficher la ligne wallet dès que `useWalletCredits` est actif et qu’un montant est appliqué. |
| Devis checkout | Le récap client calcule encore `rooms.basePrice × nuits`, alors que l’API facture les prix `room_availability.price` nuit par nuit via `evaluateBookingRules`. | Prix affiché avant validation différent du montant réellement créé/facturé. | Ajouter un devis API non persistant aligné sur `POST /api/bookings` et bloquer la progression tant que ce devis n’est pas frais. |
| Dates / disponibilité | Fiche et réservation peuvent propager des dates passées ; la fiche ne tient compte que des réservations, pas du stop-sell ni du stock journalier. | CTA « Réserver » peut mener à un 400/409 évitable. | Sanitiser les dates passées, borner les inputs, utiliser `evaluateBookingRules` côté fiche pour les CTA et l’alerte prix contextuelle. |
| Validation hôte | `/api/auth/me` ne renvoie pas `approvalStatus`; l’UI admin ne peut pas ré-approuver un hôte rejeté; bulk properties peut approuver sans gate. | Statut hôte opaque, incohérence entre action unitaire et action groupée. | Exposer le statut courant, afficher un badge dans le compte, rendre le bouton d’approbation disponible sur `rejected`, appliquer `requireApprovedHost` dans le bulk. |
| Modération / audit | Les API acceptent déjà des motifs (`reason`, `moderationReason`) mais plusieurs UI ne les collectent/transmettent pas, ou l’audit ne les stocke pas. | Traçabilité incomplète des refus/suspensions. | Ajouter des prompts facultatifs et inclure les raisons dans `audit_log.metadata`. |
| Messagerie dashboard | Admin liste une file vide malgré l’accès détail existant ; l’API d’envoi refuse l’admin. | Support/admin ne peut pas suivre ou répondre aux conversations. | Lister toutes les conversations pour admin, autoriser admin comme participant support, sans ouvrir l’accès aux non-participants. |
| Billing | Le formulaire de compte de versement est masqué quand aucun payout projeté n’existe. | Un hôte sans revenu ne peut pas préparer son compte de versement. | Afficher le setup de versement indépendamment des payouts projetés. |
| Référentiels | Les types d’hébergement/pays sont dupliqués avec des listes divergentes. | Options manquantes en recherche/compte, incohérence entre création et filtre. | Centraliser types/pays dans `src/lib/*` et réutiliser dans recherche, propriété, compte, réservation. |
| Chambres | L’action bulk `delete` supprime physiquement une chambre et ses FK annexes si pas de booking futur. | Risque de perte de configuration et d’historique opérationnel. | Transformer l’action en désactivation (`isActive=false`) et ajuster le wording. |
| Calendrier | Une plage invalide peut générer une liste vide ou lancer un fetch inutile ; l’API restait permissive sur les dates passées. | UX confuse, erreurs API évitables et possibilité d’écrire de l’inventaire historique. | Valider localement la plage avant reload/batch/save et ajouter une défense serveur sur format, dates passées et plage maximale. |
| Analytics avis | La moyenne dashboard inclut potentiellement des avis non approuvés. | KPI public/privé incohérent. | Calculer la moyenne sur les avis `approved`, en gardant le total affiché séparé. |

## Risques et mitigations

- **Régression paiement manuel** : manuel reste la valeur par défaut ; `payOnline` n’est envoyé que sur sélection explicite ; la garde `shouldShowStripeForm` reste prioritaire.
- **Surbooking** : les contrôles serveur de `POST /api/bookings` ne sont pas relâchés ; la fiche ajoute seulement une prévention UI.
- **Accès admin messages** : l’ouverture est limitée au rôle `admin`; les voyageurs/hôtes restent soumis au contrôle participant existant.
- **Bulk properties** : refus par item (`skipped`) plutôt qu’échec global pour préserver le contrat bulk.
- **i18n/typecheck** : toute nouvelle clé FR doit être traduite EN car `EN: Record<UiStringKey,string>` bloque la compilation.

## Validation prévue

1. Tests unitaires ciblés pour référentiels, dates fiche et `/api/auth/me`.
2. Tests d’intégration messages et devis checkout (`/api/bookings/quote`) sur base locale.
3. Chaîne complète demandée : `typecheck`, `lint`, `test`, `build`, `smoke`, `i18n:check`, `ai:check`.
