# Audit profond d’exécution — pages, boutons et scénarios métier

**Date :** 2026-08-23
**Périmètre :** état après T-104, parcours public/voyageur/hôte/admin, actions visibles et promesses produit.
**Méthode :** DB seedée, pages HTTP, smoke 91/91, tests 215/215, lecture des composants et handlers.

## Verdict

Les flux critiques précédemment corrigés (réservation, stockage quotidien, permissions, pièces jointes, rate plans, provider vault) sont désormais cohérents. Les risques qui restent sont principalement des **promesses UX/métier non branchées** ou des fonctions opérationnelles incomplètes. Aucun des points ci-dessous ne doit être corrigé par simple ajout visuel : le traitement métier, le texte et les tests doivent évoluer ensemble.

---

## P1 — À corriger avant de promettre une fonctionnalité en production

### 1. Centre d’aide : recherche, catégories et questions sont décoratives

**Scénario** : un voyageur ouvre `/aide`, tape une question, clique une catégorie ou une question fréquente.

**Constat** : `src/app/(main)/aide/page.tsx` affiche un champ de recherche sans état/submit, des cards `cursor-pointer` sans lien ni handler, et des questions fréquentes sous forme de simples `<div>`. Les articles affichés n’existent pas. Le téléphone est un placeholder `+237 XXX XX XX XX`.

**Impact** : l’écran présente une aide interactive qui ne permet pas d’obtenir une réponse. Cela augmente les emails support et dégrade la confiance.

**Solution sans régression** :

1. remplacer les catégories et questions par des articles réels, URL stables et contenu versionné ;
2. ou, avant livraison des articles, les rendre explicitement non cliquables et ne proposer que les canaux réellement actifs ;
3. implémenter une recherche côté serveur sur le corpus d’articles ;
4. remplacer le placeholder téléphone par un numéro validé ou retirer le bloc.

### 2. Garantie meilleur prix : promesse sans parcours de réclamation

**Scénario** : la fiche logement affiche « Trouvé moins cher ailleurs ? On vous rembourse la différence ».

**Constat** : aucun formulaire, aucune route API, aucune politique, aucune preuve à joindre, aucun statut de réclamation ni traitement de remboursement lié à cette garantie n’existent.

**Impact** : promesse commerciale/financière non actionnable et potentiellement risquée.

**Solution** : créer un dossier de réclamation (réservation, URL concurrente, montant, pièces justificatives, statut admin, décision, remboursement) ou retirer ce texte jusqu’à disponibilité.

### 3. Conditions d’annulation affichées de manière générique

**Scénario** : la liste des chambres affiche `✓ Annulation gratuite` même si la property/rate plan peut être `strict` ou `non_refundable`.

**Constat** : l’API applique maintenant la politique snapshotée à l’annulation, mais la fiche chambre montre encore une promesse générique indépendante du rate plan sélectionné.

**Impact** : le client peut choisir une offre non remboursable en ayant vu « annulation gratuite ».

**Solution** : afficher la politique du rate plan sélectionné dans la carte chambre et dans le checkout ; seulement afficher « gratuite jusqu’au … » si le calcul réel le confirme.

### 4. Confirmation email encore sans vraie outbox

**Scénario** : Stripe/webhook ou mail provider accepte un email puis la connexion applicative échoue avant l’horodatage DB.

**Constat** : T-104 verrouille le booking et persiste `confirmationEmailSentAt`, ce qui couvre les retries normaux. Un email exactement-une-fois vis-à-vis d’un fournisseur externe reste impossible sans clé d’idempotence fournisseur ou outbox transactionnelle.

**Impact** : risque rare de double email ou de notification manquante lors d’une panne réseau au mauvais moment.

**Solution** : table outbox/notification avec état, idempotency key fournisseur, worker de retry et métriques d’échec. Ne pas modifier le statut paiement lors d’un échec email.

---

## P2 — Parcours importants incomplets ou mal pensés

### 5. Les chiffres destinations de l’accueil sont fictifs

Les cartes Paris, Marrakech, Barcelone, etc. affichent des chiffres tels que `2450+ hébergements` alors que les données proviennent d’un tableau codé en dur et non de la base. Les destinations peuvent mener à zéro résultat (ex. Rome si non seedée).

**Solution** : compter les properties actives par ville ou afficher « Découvrir Paris » sans nombre tant qu’aucun compteur réel n’existe.

### 6. Avis « utile » non persistant par utilisateur

Le bouton est maintenant visible, mais le backend limite en mémoire un vote par utilisateur/avis pendant 24 h. Un redémarrage ou une seconde instance permet de revoter ; il n’existe pas de table de votes.

**Solution** : table `review_votes(reviewId,userId)` avec unique index ; compteur agrégé ou calcul atomique. Conserver le rate-limit comme protection supplémentaire.

### 7. Upload privé orphelin après annulation du composeur

Un fichier est uploadé avant l’envoi du message. Si l’utilisateur ferme, annule ou échoue ensuite, la `attachmentKey` reste privée mais orpheline.

**Solution** : statut `pending` d’upload, nettoyage cron des clés non rattachées après délai, ou transaction/message draft qui attache le fichier avant finalisation.

### 8. Rate plans : création et sélection sans édition/archivage

L’hôte peut maintenant créer et utiliser un rate plan, mais ne peut pas encore le modifier, le désactiver ou le supprimer depuis l’UI. La création choisit actuellement un type technique fixe `flexible`.

**Solution** : CRUD rate plan complet avec désactivation plutôt que suppression si déjà utilisé. Les snapshots booking existants doivent rester inchangés.

### 9. Recherche : pagination sans total exact

La pagination affiche une page et un bouton suivant si 20 résultats sont présents, mais ne donne pas le total ni le dernier numéro de page. Les filtres avancés couvrent maintenant voyageurs/équipement/tri, mais il manque carte, proximité UI complète et total SQL.

**Solution** : requête `COUNT(*)` cohérente avec les mêmes filtres, pagination stable avec tie-breaker `id`, page dernière/précédente/suivante et tests de conservation d’URL.

### 10. Alertes prix encore limitées au prix de base

Le libellé a été corrigé, mais l’alerte ne suit pas encore le prix réel du séjour : ni dates, ni voyageurs, ni override journalier, ni disponibilité à la date demandée.

**Solution** : sauvegarder un contexte de séjour dans l’alerte et appeler le même moteur de devis que le checkout. Tant que ce n’est pas le cas, garder clairement « prix de base ».

### 11. Export CSV : pas une facture, et risque de formule tableur

L’export CSV est utile mais une property saisie par un hôte peut commencer par `=`, `+`, `-` ou `@`; ouverte dans un tableur, elle peut devenir une formule. L’export n’est pas une facture légale ni un payout.

**Solution** : neutraliser les cellules commençant par ces caractères avec un préfixe apostrophe, ajouter période/devise, puis concevoir un ledger/facture séparé avec règles fiscales.

### 12. Provider test : résultat ponctuel sans historique opérationnel

Le bouton test provider est une avancée utile. Il n’enregistre cependant pas la date du dernier test, son résultat, la latence ou les échecs récurrents dans une vue d’exploitation.

**Solution** : statut `lastTestAt/lastTestStatus` sans secret, journal audit filtrable, puis monitoring/alerte externe. Les valeurs réelles doivent rester masquées.

---

## Points positifs vérifiés

- réservation : capacité, stock journalier, minStay et concurrence contrôlés côté serveur ;
- rate plan sélectionné → remise et snapshot enregistrés ;
- webhook mock → booking confirmé + `confirmationEmailSentAt` ;
- pièce jointe : participant `200`, tiers `403` ;
- coffre provider : chiffrement, RBAC, suppression/fallback et clé Stripe publique séparée ;
- export CSV hôte privé opérationnel ;
- typecheck, build, smoke 91/91 et 215 tests réussis.

## Plan recommandé sans régression

1. **Vague sécurité/finance** : outbox email, votes persistants, nettoyage uploads, CSV safe.
2. **Vague promesses produit** : aide réelle, garantie prix ou suppression, politique annulation contextuelle.
3. **Vague produit hôte** : CRUD rate plans et test provider historisé.
4. **Vague recherche** : count/pagination stable, contexte alerte prix par séjour.

Chaque vague doit ajouter ses migrations de manière additive, conserver les contrats actuels, ajouter tests DB/browser et ne rendre visible une promesse qu’après son parcours complet.
