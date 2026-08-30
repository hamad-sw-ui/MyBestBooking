# Analyse d’impact — T-107 : orchestration fiable des paiements et opérations différées

- **Niveau** : C
- **Statut** : en cours
- **Motif** : l’audit d’exécution T-106 a montré plusieurs écarts transverses : succès de paiement reçu après expiration, appel PSP sous verrou transactionnel, suppression d’avis avec votes, ambiguïté exactly-once de l’outbox, alertes de prix qui ignoraient le séjour, pagination/calendrier incomplets, édition de plans tarifaires et rotation de clé maître.

## Scénarios affectés

| Scénario | Défaut avant T-107 | Conséquence |
|---|---|---|
| Stripe réussit après expiration | l’inbox consomme l’événement sans remboursement | débit voyageur sans séjour confirmé |
| création de booking lors d’un PSP lent | `provider.create()` s’exécute dans la transaction qui verrouille la chambre et le compte | contention, timeouts et risque de surbooking perçu |
| crash après création PSP | aucun mécanisme de reprise idempotente de l’intent | réservation bloquée ou intent orphelin |
| email accepté puis réponse perdue | lease DB seule, aucun identifiant d’idempotence fournisseur | doublon potentiel après reprise |
| modération/suppression d’avis voté | FK `review_votes` bloque le hard delete | action admin en échec partiel |
| alerte avec dates/voyageurs | contexte sauvegardé mais non évalué | notification trompeuse sur prix indisponible |
| résultats, calendrier et rate plans | navigation ou édition partielle | boutons/texte promettent une capacité non fournie |
| rotation de coffre | changement de clé rend les overrides illisibles | incident opérationnel de secrets |

## Surface impactée

- `bookings`, inbox de paiements, cron et fournisseurs Stripe/mock ;
- `email_outbox` et mailers Console/Resend ;
- `reviews`/`review_votes` et bulk admin ;
- moteur de règles de réservation, cron d’alertes et CTA de fiche ;
- recherche SQL, calendrier d’inventaire et interface rate plans ;
- coffre AES-GCM providers, UI admin, variables d’environnement et audit log ;
- schéma Drizzle et migration additive `0013`.

## Invariants de non-régression

1. Les réservations et snapshots tarifaires déjà créés restent lisibles et ne sont jamais recalculés.
2. Le mock demeure utilisable en dev/test ; Stripe réel reste conditionné à des clés fournisseur et ne sera pas déclaré validé sans elles.
3. Les appels réseaux PSP/mailer ne sont jamais faits dans une transaction DB ouverte.
4. Une réservation annulée après un succès tardif garde son historique, est marquée financièrement et fait l’objet d’une demande de remboursement idempotente.
5. Les promotions/wallet réservés par une tentative non payée sont relâchés une seule fois.
6. Les fichiers, URLs legacy, endpoints existants et fallback environnement providers restent compatibles.
7. Les migrations sont exclusivement additives / modification contrôlée de FK ; aucune donnée historique n’est supprimée sans action admin explicite.

## Risques et protections

| Risque | Protection retenue |
|---|---|
| double refund après plusieurs événements | clé d’idempotence déterministe par booking + état `refundStatus` persisté |
| création intent sans réponse réseau | booking pending avec TTL + reprise cron avec même clé PSP |
| confirmation d’un booking déjà expiré | condition d’état sous verrou avant mutation |
| double email après crash | clé `eventKey` envoyée au fournisseur et message id conservé |
| cascade accidentelle de données | cascade limitée à `review_votes`; suppression explicite des votes dans bulk |
| coût SQL alerte/recherche | sélection bornée, calcul seulement pour alertes contextualisées et count séparé |
| rotation irréversible | double keyring temporaire, réchiffrement explicite et audit sans secret |

## Validation exigée avant clôture

- migration fraîche jusqu’à `0013` ;
- webhook paiement tardif → remboursement mock, puis idempotence de la reprise ;
- création d’intent hors transaction et reprise d’un booking pending sans intent ;
- suppression bulk d’un avis possédant un vote ;
- retry outbox avec même clé et stockage de l’identifiant fournisseur ;
- quote d’alerte avec prix journalier, stock/stop-sell/capacité ;
- pagination count et ordre stable ; calendrier >90 jours ; PATCH de plan tarifaire ;
- rotation keyring avec clé précédente, sans exposition de secret ;
- typecheck, lint, tests, build, smoke, `ai:check` et smoke HTTP/API ciblé.
