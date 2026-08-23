# 🎯 TÂCHE EN COURS

**Tâche :** Corriger les défauts prioritaires détectés par l’audit post-providers.
**ID** : T-104
**Niveau** : **C** — post-actions Stripe, remboursements, stockage privé, rate plans et migrations.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Livré

- confirmation booking partagée entre mock/webhook, marqueur persistant ;
- événements refund Stripe typés et réconciliés ;
- upload messages privé, téléchargement participant, S3 sans ACL publique et
  suppression de clés `uploads/...` ;
- rate plans créables par hôte, sélectionnables au checkout, snapshot booking
  et politique d’annulation appliquée ;
- test provider admin explicite ;
- prix min/max recherche unifié, avis utile visible, promesses BestRewards
  réalignées sur les capacités réelles.

## Preuves

- 🔨 typecheck/build ;
- 🧪 Vitest DB+serveur : **215/215** ;
- ▶️ migration fraîche 0010 ;
- ▶️ webhook confirmation + email marker ;
- ▶️ attachment participant 200 / outsider 403 ;
- ▶️ rate plan snapshot ;
- ▶️ smoke 91/91 et ai:check sans fail.

## Limites

Les appels réels Stripe/Resend/S3 demandent toujours des clés de test valides ;
le test admin les exerce seulement lorsqu’une configuration réelle existe.
