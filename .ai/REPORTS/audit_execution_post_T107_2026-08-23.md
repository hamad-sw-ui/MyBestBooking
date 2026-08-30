# Audit d’exécution post T-107 — pages, boutons, API et séquences

## Parcours rejoués

1. **Voyageur / réservation** : hold transactionnel, intent mock post-commit, confirmation et outbox. Le succès tardif ne peut plus transformer une annulation en séjour confirmé ; il devient une compensation tracée.
2. **Administrateur / bulk avis** : une action destructive avec vote associé supprime maintenant les dépendances dans une transaction; la FK DB protège aussi les suppressions directes.
3. **Voyageur / alerte prix** : le CTA change sa promesse selon le contexte. Avec dates et voyageurs il sauvegarde les quatre données nécessaires; le cron ne notifie que si une chambre peut réellement satisfaire le séjour au prix calculé.
4. **Hôte / calendrier** : les champs ne sont plus visuellement coupés au 90e jour. Les contrôles précédent/suivant font parcourir les segments, la sauvegarde conserve les modifications de toutes les pages et les envoie par lots API bornés.
5. **Hôte / plans tarifaires** : les boutons Modifier/Annuler/Archiver sont fonctionnels. L’aperçu est explicitement indicatif (prix de base, hors taxes/promo/wallet); l’API et les snapshots historiques restent l’autorité.
6. **Admin / coffre** : le bouton de rotation apparaît seulement si une clé précédente est détectée côté serveur. Il lance un vrai réchiffrement confirmé; aucune clé n’est saisie ou affichée dans le navigateur.

## Éléments volontairement non simulés

- aucune fausse validation de connexion Stripe, Resend ou S3 : le panneau garde son test fournisseur explicite et retourne des codes sûrs ;
- aucune facture légale, payout ou SLA support prétendu ;
- aucune redirection vers les anciennes URLs publiques de pièces jointes : la sécurité prime. Le composeur permet de joindre une nouvelle copie privée au fil.

## Risques résiduels à surveiller

- suivre les retries `refundStatus=pending` et les outbox `failed` en exploitation ; un dashboard opérationnel dédié serait une évolution utile ;
- mettre en place une queue/worker dédié si le volume ou le multi-instance dépasse le cron actuel ;
- ajouter un vrai flux de reprise Stripe Elements après une panne réseau pendant la préparation d’intent ;
- terminer l’E2E navigateur dès que Chromium est disponible.
