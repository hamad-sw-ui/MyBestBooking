# Débat technique — T-102 : remédiation audit runtime

**Niveau : C.** Les points ci-dessous sont des recommandations contradictoires, confrontées ensuite au code et aux contraintes du projet.

| Rôle | Recommandation | Objection / risque | Alternative |
|---|---|---|---|
| Architecte | Centraliser règles de séjour et devis dans un service métier. | Un gros service peut devenir un god-object. | Règles pures petites + orchestration API distincte. |
| Développeur Next.js | Utiliser un endpoint de devis et composants client fins. | Multiples requêtes lors de la saisie. | Debounce, devis seulement sur action/dates complètes. |
| Expert PostgreSQL | Conserver lock `FOR UPDATE` de chambre et calculer toutes les nuits dans transaction. | Boucles nuits longues et contention. | Borner la durée du séjour et indexer les requêtes. |
| Expert sécurité | Aucun voyageur ne doit clôturer un séjour ; aucune carte native. | Une clôture cron tardive peut retarder avis/fidélité. | Hôte/admin après check-out, tracé audit. |
| Expert paiement | Stripe Elements + webhook est la seule confirmation fiable. | Clé publique et comptes Stripe requis, impossibles à tester live ici. | Conserver mock dev explicite et état pending honnête. |
| Expert finance | Utiliser un journal financier complet avant reporting. | Migration trop grande pour un seul cycle. | Colonnes remboursement additives maintenant, journal complet au backlog. |
| Expert QA | Ajouter tests DB de stock quotidien et tests purs, pas seulement smoke. | Suite intégration dépend d’une DB vivante. | Skip conditionnel conservé + script runtime documenté. |
| Expert UX | Ne jamais montrer des moyens de paiement inexistants ; conserver le contexte dates/pax. | Moins de choix visuel au départ. | Payment Element affiche les méthodes réellement activées. |
| Expert produit | Garder achat invité pour réduire l’abandon. | Comptes stub/communications support plus complexes. | Exiger compte, mais supprimer alors API et texte guest. |
| Expert DevOps | Cron protégé par secret et idempotent, Vercel config déclarative. | Toutes les cibles ne lancent pas `vercel.json`. | Script/route manuel administrateur et monitoring à ajouter. |
| Relecteur | Réparer d’abord les invariants serveur avant les boutons. | Le produit reste visuellement incomplet quelques étapes. | Aucun : la sécurité métier prévaut. |

## Synthèse

- 🔍 Le code actuel duplique la disponibilité entre recherche et booking et ignore une partie des overrides : la centralisation est retenue.
- 🔍 Le checkout affiche des moyens non connectés : l’avis paiement/UX est retenu ; aucun PAN/CVV ne sera collecté localement.
- 🔍 Le mock existant permet les tests sans Stripe : il reste en développement, mais l’interface doit l’indiquer et Stripe pending ne peut pas être assimilé à payé.
- 🧠 Un journal comptable complet est préférable, mais son modèle métier (payout hôte, taxe, facture légale) dépasse les faits disponibles. Les colonnes de remboursement idempotentes constituent une étape sûre, pas une prétendue comptabilité complète.
- 🔍 Le proxy empêche aujourd’hui le guest checkout alors que l’API le gère : conserver le guest checkout est retenu afin de préserver la capacité livrée, avec contrôles serveur.

## Décision finale

Retenir la solution B de conception : règles pures + transaction + migration additive + UI adaptatrice. Les promesses non encore pleinement déployables (Stripe live, facture légale) seront formulées honnêtement et testées dans leur état réel. Le risque résiduel accepté est l’absence de clés Stripe réelles dans le sandbox ; il ne sera jamais masqué comme un paiement validé.
