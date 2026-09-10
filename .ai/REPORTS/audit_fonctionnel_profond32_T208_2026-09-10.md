# Audit fonctionnel profond n°32 — T-208 — Scénarios runtime après T-207

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Type** : audit runtime / analyse produit, sans correctif code appliqué dans cette passe
- **Demande** : refaire une analyse profonde des scénarios et éléments fonctionnels du projet à l'exécution (pages, boutons, fonctionnalités), repérer ce qui reste inachevé ou mal pensé, expliquer chaque problème et proposer une solution sans régression.

## 1. Méthode

L'audit a combiné :

- build production Next.js ;
- seed et navigation runtime via serveur local ;
- crawl multi-profils ;
- smoke HTTP ;
- simulations longues ;
- simulation dédiée dashboards/bulk ;
- probes ciblés sur les parcours sensibles restants après T-207.

Commandes/probes exécutés :

- 🔨 `npm ci` — OK, avec 8 vulnérabilités npm déjà connues/hors périmètre immédiat.
- 🔨 `npm run env:restore` — OK, `.env.local` preview et PostgreSQL local restaurés.
- 🔨 `npm run build` — OK, Next.js 16.2.6, 65/65 pages générées.
- ▶️ `POST /api/seed` avec token local — OK, données de démo créées.
- ▶️ `npm run site:audit -- http://127.0.0.1:3000` — OK, 245 pages visitées, 0 issue.
- ▶️ `SEED_TOKEN=arena-seed-token-2026 npm run smoke` — OK, 95/95 assertions.
- ▶️ `python3 scripts/run_all_sims.py` — OK global, 5/5 simulations, 398 OK / 5 WARN / 0 KO.
- ▶️ `python3 scripts/dashboards_sim.py` — 67 OK / 0 WARN / 2 KO, KO analysés ci-dessous.
- ▶️ Probes ciblés : `/connexion`, `/reservation`, `/mes-reservations`, `/dashboard/billing`, `/dashboard/settings`, création booking no-payment, saturation de stock pending, emails outbox.
- ▶️ `node scripts/reset_test_db.mjs` — OK après audit pour nettoyer les artefacts.
- ✅ `npm run ai:check && git diff --check` — OK, 20 OK / 0 warn / 0 fail, aucune erreur whitespace.

## 2. Ce qui fonctionne bien et doit être préservé

- Le build production passe et génère toutes les pages attendues.
- Le crawl runtime multi-profils ne trouve ni 404/500 ni problème i18n bloquant sur les pages parcourues.
- Le smoke passe intégralement : pages publiques, pages protégées, RBAC, login des trois rôles, wishlist, alerte prix, réservation pending.
- Les simulations longues passent sans KO : recherche, fiches, devis/disponibilité, guest booking, annulation, messagerie, profils, admin, sécurité, i18n, bulk principal.
- T-207 est bien visible au runtime : `/reservation`, `/mes-reservations`, `/dashboard/billing` et `/dashboard/settings` ne contiennent plus de déclencheur visible `Payer maintenant`, `Pay now`, `PaymentElement`, `StripePaymentForm`, `/reservation?booking=` ; `/dashboard/billing` affiche l'avis de versements plateforme désactivés ; `/dashboard/settings` affiche l'avis de paiement en ligne désactivé et ne rend plus la clé publique Stripe.
- `/api/providers/stripe` renvoie `{ configured:false, onlinePaymentDisabled:true }` sans clé publique.

## 3. Findings prioritaires

### F1 — Critique — Les demandes `pending` bloquent le stock indéfiniment depuis la suppression du paiement en ligne

**Constat runtime**

Après T-207, une réservation créée sans paiement reste `status:"pending"`, `paymentStatus:"pending"`, `paymentExpiresAt:null`. Les règles de disponibilité comptent toutes les réservations non annulées (`status != cancelled`) comme occupation. Probe réalisé sur une chambre `quantity=2` :

- création demande 1 → HTTP 201, `status=pending`, `paymentExpiresAt=null`, `payment=null` ;
- création demande 2 → HTTP 201, `status=pending`, `paymentExpiresAt=null`, `payment=null` ;
- création demande 3 sur les mêmes dates → HTTP 409 `Cette chambre n'est plus disponible pour ces dates` ;
- en DB, les deux demandes bloquantes restent pending sans expiration.

**Problème**

Le nouveau modèle "demande sans paiement" a retiré l'expiration des holds de paiement, mais la disponibilité continue de traiter les demandes pending comme des réservations fermes. Un voyageur ou un bot peut donc saturer l'inventaire avec des demandes non confirmées. Si l'hôte ne traite pas rapidement les demandes, les chambres deviennent invisibles/indisponibles pour d'autres voyageurs alors qu'aucun paiement n'a été encaissé et aucune confirmation n'a été donnée.

**Solution sans régression**

Deux options sûres, à arbitrer produit :

1. **Soft-hold avec expiration longue** : ajouter un `requestExpiresAt` configurable (ex. 24h/48h) pour les demandes `pending`; le cron expire uniquement les demandes non confirmées et notifie voyageur + hôte. La disponibilité continue de compter `pending`, mais seulement jusqu'à l'expiration. Préserve le modèle anti-surbooking actuel.
2. **Demande non bloquante jusqu'à confirmation** : ne compter que `confirmed/completed` dans la disponibilité, et refaire une transaction de stock au moment où l'hôte confirme. Si le stock est parti, l'hôte reçoit un 409 propre et doit proposer d'autres dates. Préserve la liberté commerciale mais autorise plusieurs demandes concurrentes.

Recommandation : option 1 par défaut (moins de risque de surbooking), avec UI hôte indiquant le délai restant et action "refuser/libérer".

Tests de non-régression à ajouter :

- 2 demandes pending saturent la chambre jusqu'à `requestExpiresAt` ;
- après expiration cron, le stock redevient disponible ;
- une demande confirmée ne s'expire jamais ;
- annulation explicite libère le stock ;
- les anciennes réservations sans `requestExpiresAt` sont migrées prudemment ou considérées non expirables selon une règle documentée.

---

### F2 — Élevé — Aucune notification/email immédiat lors d'une demande de réservation connectée

**Constat runtime**

Probe outbox : après création d'une réservation connectée sans paiement, la réponse API est bien HTTP 201, mais `.data/mails` reste à 0 fichier. La simulation deep signale aussi : `Après booking : 0 email(s) écrit(s) dans .data/mails/`. Les emails d'annulation et de confirmation hôte fonctionnent, mais il manque l'accusé de réception immédiat de la demande.

**Problème**

Dans un modèle sans paiement en ligne, la création de demande devient l'événement principal. Si aucun email n'est envoyé à l'hôte, il dépend uniquement du dashboard pour découvrir la demande. Si aucun accusé n'est envoyé au voyageur connecté, il n'a pas de preuve immédiate hors UI. Le risque augmente avec T-207 : avant, le paiement était un signal fort ; maintenant la demande doit être explicitement notifiée.

**Solution sans régression**

Créer un événement outbox idempotent `booking.request.created:{bookingId}` qui envoie :

- à l'hôte : nouvelle demande à confirmer/refuser, dates, chambre, montant de référence, lien dashboard ;
- au voyageur : demande reçue/transmise, aucun paiement en ligne, montant de référence, lien Mes réservations/messages.

Ne pas réutiliser l'email de confirmation existant : il doit rester réservé à `status=confirmed` pour ne pas confondre demande reçue et réservation confirmée.

Tests à ajouter :

- POST booking connecté → 2 emails demande (guest + host), idempotents ;
- POST guest booking → email claim existant conservé + email demande distinct ;
- confirmation hôte continue d'envoyer l'email confirmation existant une seule fois.

---

### F3 — Élevé — Les comptes démo/admin et mots de passe sont visibles publiquement sur `/connexion`

**Constat runtime**

La page `/connexion` rend publiquement :

- `admin@mybestbooking.com` ;
- `Admin123!` ;
- `host@mybestbooking.com` ;
- `Customer123!` ;
- boutons de connexion démo en un clic.

**Problème**

C'est utile en environnement démonstration, mais dangereux si ce rendu atteint une préproduction ou une production : un visiteur peut se connecter comme admin/hôte si les comptes existent. Même si la seed route est protégée en production, la page expose quand même des identifiants sensibles et normalise l'idée qu'un accès admin public existe.

**Solution sans régression**

Gater l'affichage par une configuration explicite :

- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` uniquement en sandbox/demo ;
- cacher complètement les mots de passe en production ;
- optionnel : garder seulement un bouton "Compte voyageur démo" sans admin/hôte ;
- côté API login, refuser les comptes `@mybestbooking.com` de démo si `DEMO_LOGIN_ENABLED !== true` et si `NODE_ENV=production`.

Tests à ajouter :

- rendu `/connexion` avec flag off → aucune adresse/mot de passe démo ;
- flag on → boutons présents pour smoke ;
- production + compte démo → login refusé sauf flag explicite.

---

### F4 — Moyen — Le bouton seed de la page d'accueil est un formulaire public brut et non un parcours UX contrôlé

**Constat**

Si aucune propriété n'est présente, `src/app/page.tsx` affiche un formulaire HTML `POST /api/seed` sans token ni gestion d'erreur. En développement, cela peut charger les données ; en production, la route renvoie `404 Not Found` sans UX car elle exige un token. Le bouton n'était pas visible dans le seed actuel, mais le code est dans le parcours "première visite".

**Problème**

Sur un environnement vide, l'utilisateur final peut cliquer et atterrir sur une réponse brute API. En environnement non production mal configuré, un visiteur public peut peupler la base de démonstration. C'est un mélange entre outil développeur et interface produit.

**Solution sans régression**

- Afficher ce bloc uniquement si `NEXT_PUBLIC_ENABLE_DEMO_SEED=true`.
- Transformer le formulaire en bouton client avec fetch + toast + retour sur la page, ou en Server Action réservée au mode démo.
- En production, remplacer par un état vide produit : "Aucun hébergement disponible pour le moment" + CTA hôte/admin.

Tests à ajouter :

- accueil sans propriété + demo flag off → état vide sans formulaire `/api/seed` ;
- flag on → seed possible et message UI propre ;
- production sans token → aucune fuite de route dans l'UI.

---

### F5 — Moyen — Billing/versements : l'UI est désactivée, mais les routes legacy restent potentiellement actionnables

**Constat**

T-207 a correctement remplacé le bloc UI de versement par "Versements plateforme désactivés". En revanche, les routes `GET/POST /api/host/payouts`, `GET/POST /api/host/payout-account` et le cron payout restent présentes pour compatibilité technique. Dans la base actuelle, `GET /api/host/payouts` renvoie vide, mais le code POST conserve l'exécution provider/mock dès qu'un payout éligible existe.

**Problème**

La promesse UI dit que les versements plateforme sont désactivés parce que la plateforme n'encaisse plus les réservations. Si un hôte/admin ou un script appelle encore l'API legacy, le système peut enregistrer/exécuter des payouts en contradiction avec l'UI. Ce n'est pas un paiement voyageur, mais c'est une incohérence finance/back-office.

**Solution sans régression**

- Introduire un flag serveur `PLATFORM_PAYOUTS_ENABLED=false` par défaut tant que `ONLINE_PAYMENTS_ENABLED=false`.
- Autoriser `GET` en lecture historique, mais faire répondre `POST /api/host/payouts` et le cron payout en `410` ou `423 disabled` avec message localisé.
- Conserver les tests legacy sous flag on pour ne pas perdre la couverture T-195.

Tests à ajouter :

- flag off → POST payout 410, aucune écriture/aucun provider appelé ;
- flag off → GET ledger/export restent disponibles ;
- flag on → tests T-195 existants inchangés.

---

### F6 — Moyen — La simulation dashboards est désynchronisée du comportement produit "soft-delete room"

**Constat runtime QA**

`python3 scripts/dashboards_sim.py` termine avec 2 KO :

1. Bulk cancel mix : l'API retourne bien `succeeded=1` et `skipped=1`, mais la simulation exige que la raison contienne le mot `transition`; la raison réelle est plus claire : `Cette réservation ne peut plus être annulée`.
2. Bulk delete rooms : l'API retourne `succeeded=2`, mais les lignes restent en base avec `is_active=false`; la simulation attend encore un hard-delete `count=0`.

**Problème**

Le produit a évolué vers un soft-delete opérationnel des chambres, mais le harnais QA dédié dashboards conserve une hypothèse ancienne. Cela crée du bruit : un futur audit peut croire à une régression alors que l'API protège correctement l'historique.

**Solution sans régression**

Mettre à jour `dashboards_sim.py` :

- pour bulk cancel, vérifier `succeeded=1` + `skipped=1` + statut non annulable, sans dépendre d'un mot exact ;
- pour rooms delete, vérifier `is_active=false` et non la disparition physique ;
- renommer le libellé du test en "désactivation/soft-delete".

Ce correctif ne touche pas le produit, seulement la preuve QA.

---

### F7 — Faible/Moyen — Deux composants client avec fetch silencieux n'ont pas d'état loading/feedback explicite

**Constat QA**

La simulation xtreme signale :

- `src/components/maintenance-gate.tsx` : fetch sans loading/feedback ;
- `src/components/unread-messages-badge.tsx` : fetch sans loading/feedback.

**Problème**

Ces composants sont volontairement silencieux pour ne pas casser la navigation. Cependant, pour la pastille messages, une erreur réseau fait disparaître le compteur sans explication ; pour la maintenance, le serveur garde la sécurité mais le client ne montre aucun état si la sonde échoue.

**Solution sans régression**

- `UnreadMessagesBadge` : conserver le silence en cas 401, mais ajouter un état discret pour erreur authentifiée (`aria-label`, tooltip ou dernier compteur connu) et un test de non-régression navigation.
- `MaintenanceGate` : garder `return null` en fonctionnement normal, mais journaliser/mesurer les échecs de sonde côté client ou exposer un mini état uniquement sur page maintenance/admin.

Priorité plus basse car les gardes serveur restent la source de vérité.

## 4. Points surveillés mais non retenus comme régressions

- **Paiement en ligne voyageur** : aucun déclencheur runtime visible n'a été retrouvé sur les pages clés auditées. T-207 tient.
- **Stripe legacy en code** : les modules historiques existent encore, mais `/api/providers/stripe` est neutralisé et le tunnel ne peut pas afficher Stripe. Pas une régression tant que l'API booking reste défensive.
- **Dashboard dynamic pages** : certains accès non autorisés suivis par `curl -L` finissent en 200 de page redirigée, mais les données sensibles ne sont pas exposées dans les probes. À surveiller dans un audit sécurité plus strict.
- **Warnings `run_all_sims`** : les 5 WARN restants correspondent principalement aux observations F2/F7 et au bruit QA, pas à des 500/KO applicatifs.

## 5. Ordre de traitement recommandé

1. **F1** — régler le modèle de stock des demandes pending sans paiement (TTL ou confirmation transactionnelle).
2. **F2** — ajouter les emails/notifications "demande reçue" pour hôte + voyageur.
3. **F3/F4** — gater les surfaces démo publiques (`/connexion`, bouton seed accueil).
4. **F5** — aligner routes payout legacy avec l'UI disabled via feature flag.
5. **F6** — nettoyer le harnais dashboards pour éviter les faux KO.
6. **F7** — améliorer les feedbacks silencieux des fetchs non critiques.

## 6. Validation attendue si correction

Pour une prochaine passe de correction, ne pas casser les acquis : recherche, fiches hébergement, devis/disponibilité, réservation sans paiement en ligne, confirmation hôte, annulation, messagerie, compte invité, RBAC admin/hôte, i18n, T-207 sans paiement plateforme.

Chaîne proposée :

- `npm run typecheck`
- `npm run lint`
- `npm run i18n:check`
- tests ciblés F1/F2/F3/F5/F6
- `npm test`
- `npm run build`
- `SEED_TOKEN=... npm run smoke`
- `npm run site:audit -- http://127.0.0.1:3000`
- `python3 scripts/run_all_sims.py`
- `python3 scripts/dashboards_sim.py`
- `npm run ai:check && git diff --check`
