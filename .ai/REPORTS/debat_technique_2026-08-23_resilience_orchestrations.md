# Débat technique — T-107

## Architecte

**Position** : remplacer les effets externes dans une transaction par une orchestration persistante/rejouable. Le booking est le journal métier de l’intent : il contient référence, montant, devise, email et TTL nécessaires à une reprise sans nouveau contrat public.

## SRE / fiabilité

**Objection** : une réponse PSP perdue demeure ambiguë.

**Réponse retenue** : clé d’idempotence déterministe envoyée à Stripe/Resend, reprise cron et visibilité d’états DB. Cela ne remplace pas un ordonnanceur/outbox distribué dédié, mais couvre le crash entre provider et DB sans doublon chez le provider configuré.

## Sécurité

**Objection** : la rotation de clé ne doit jamais exposer le secret actuel ou précédent.

**Réponse retenue** : uniquement l’environnement fournit les deux clés. L’endpoint admin accepte une confirmation fixe, ne reçoit aucune clé et ne renvoie que le nombre de valeurs réchiffrées. L’audit stocke l’action et le compteur, jamais une valeur.

## Produit / finance

**Objection** : un paiement tardif pourrait devoir conserver des frais d’annulation.

**Réponse retenue** : le montant de compensation utilise `refundAmount` déjà calculé lorsque l’annulation est manuelle ; à défaut il prend `total - cancellationFee`. L’expiration possède une commission nulle : remboursement intégral. Le booking reste annulé, jamais confirmé après expiration.

## QA

**Objection** : la migration FK cascade seule ne prouve pas le flux admin.

**Réponse retenue** : tester le handler bulk avec avis et vote, plus migration fraîche. Les tests ciblés couvrent aussi intent tardif, retry outbox, quote contextualisé, pagination, calendrier, rate plan et keyring.

## Décision

Valider cette architecture sous réserve des preuves d’exécution listées dans l’analyse d’impact. Les providers externes réels ne seront pas déclarés testés si seules les implémentations mock/fetch sont exercées.
