# Audit d’exécution approfondi post T-107 — parcours, boutons et invariants métier

- **Date** : 2026-08-23
- **Périmètre** : parcours public/voyageur/hôte/admin, API, transactions, sécurité et opérations différées.
- **Méthode** : lecture croisée UI → API → schéma → migrations, PostgreSQL embarqué frais, HTTP local authentifié/anonyme, seed, smoke et Vitest.
- **Important** : ce rapport décrit des défauts **ouverts** ; il ne les présente pas comme corrigés. Les tests verts ne constituent pas une preuve contre les scénarios non couverts.

## Baseline d’exécution

- `npx drizzle-kit migrate` : chaîne `0000…0013` appliquée sur PostgreSQL frais.
- `npm run typecheck` : succès.
- `npm run lint` : 0 erreur, 16 warnings connus.
- `npm run smoke` : 91/91 assertions vertes.
- `npm test` : 218/218 vertes.

Ces résultats prouvent l’absence de régression couverte, pas l’absence des écarts ci-dessous.

---

## P0 — blocage sécurité, données ou argent

### AUD-108-01 — Les fiches non publiées et des champs métier privés sont publiquement accessibles

**Parcours** : visiteur anonyme → `GET /api/properties/:id` ou `/hebergement/:slug`.

**Constat source** : `src/app/api/properties/[id]/route.ts` ne filtre ni
`properties.status`, ni les champs `hostId`, `validatedBy`, `commissionRate`.
La page publique lit elle aussi directement par slug sans exiger `status=active`.

**Preuves runtime** :

- un `GET` anonyme de fiche active renvoie bien `hostId`, `commissionRate` et
  `validatedBy` ;
- une property volontairement créée `draft` répond `200` sur l’API **et** sur
  `/hebergement/audit-draft-…`, avec sa commission et l’ID hôte.

**Conséquence** : fuite de marge et d’identifiants internes, indexation/visite
d’un brouillon, exposition de contenu avant validation. Le contrôle de statut
sur la liste publique ne protège pas les URLs détail.

**Solution sans régression** : créer un unique sélecteur/projection publique
(`active` uniquement, sans champs internes), l’employer dans API et page RSC;
laisser une projection complète exclusivement pour propriétaire/admin. Retourner
404, et non 403, pour un brouillon à un visiteur afin de ne pas confirmer son
existence. Ajouter tests anonyme `active/draft/suspended`, propriétaire et admin.

---

### AUD-108-02 — Les avis masqués, en attente ou rejetés sont lisibles sans authentification

**Parcours** : visiteur → `GET /api/reviews?status=hidden`.

**Constat source** : `src/app/api/reviews/route.ts` accepte directement le
paramètre `status` sans RBAC. L’endpoint initialise `status` à `approved`, mais
n’impose jamais cette valeur au public.

**Preuve runtime** : insertion d’un avis `hidden` avec le texte
`AUDIT_HIDDEN_REVIEW`, puis appel anonyme : HTTP 200, l’avis est retourné.

**Conséquence** : contournement de modération, divulgation de contenu retiré,
possible PII dans les commentaires et perte de confiance hôte/voyageur.

**Solution sans régression** : par défaut et pour tout rôle non-admin/non-hôte
propriétaire, forcer `status='approved'`; autoriser les autres statuts seulement
dans les listes dashboard avec filtre de propriété hôte; valider `status` par
Zod et ajouter tests de matrice rôle × statut.

---

### AUD-108-03 — Un hôte peut s’auto-publier et contourner la validation admin

**Parcours** : hôte crée une property → `pending` → `PUT /api/properties/:id`
avec `{ "status": "active" }`.

**Constat source** : le schéma de `src/app/api/properties/[id]/route.ts` accepte
`status`, mais le handler ne réserve pas ce champ à l’admin.

**Preuve runtime** : property hôte créée `pending`, puis `PUT status=active`
avec le cookie hôte : HTTP 200, statut final `active`.

**Conséquence** : publication sans contrôle de qualité, fraude/contenu interdit,
annulation du workflow de validation et exposition immédiate via recherche.

**Solution sans régression** : retirer `status` du patch hôte; réserver les
transitions de publication à une fonction admin auditée (`approve/reject/suspend`).
Conserver au hôte l’archivage de son propre bien via une action explicite.
Tester les transitions hôte/admin et le refus d’auto-activation.

---

### AUD-108-04 — L’annulation bulk admin contourne paiement, remboursement et avantages

**Parcours** : admin → Dashboard réservations → sélection → action bulk
« Annuler ».

**Constat source** : `bulkBookings()` dans `src/app/api/admin/bulk/route.ts`
met uniquement `status='cancelled'`. Il ne calcule pas de frais, ne demande ni
annulation PSP ni remboursement, ne pose pas de raison et ne relâche pas
promo/wallet. Il contourne complètement `PUT /api/bookings/[id]`.

**Preuve runtime** : booking mock payé créé puis annulé via `POST /api/admin/bulk` :

```text
status=cancelled
payment_status=paid
refund_status=none
refund_amount=0.00
cancellation_reason=null
```

**Conséquence** : débit capturé sans remboursement, inventaire libéré, état
financier contradictoire, audit/support impossibles. C’est un défaut financier
bloquant.

**Solution sans régression** : extraire une commande de domaine
`cancelBooking({ actor, reason, source })`, commune à l’API individuelle,
bulk/admin et cron. Elle doit produire un état persistant de remboursement,
appeler le PSP hors transaction via une tâche idempotente, puis envoyer le mail
par outbox. Le bulk doit retourner des résultats par booking et ne jamais faire
un `UPDATE` brut de statut.

---

### AUD-108-05 — Suppression bulk de property non atomique et impossible avec historique

**Parcours** : admin → supprimer une property n’ayant que des bookings
terminaux/annulés.

**Constat source** : `bulkProperties(delete)` efface successivement
availability/rate plans/reviews puis tente de supprimer les rooms et la
property. Les FKs `bookings.room_id` et `bookings.property_id` sont `ON DELETE
NO ACTION`. Le commentaire « orpheliniser » ne correspond donc pas au SQL.

**Preuve runtime** : fixture property + room + booking `cancelled` + rate plan,
puis bulk delete : HTTP 200 avec résultat `failed`; après l’échec :

```text
property=1, room=1, rate_plan=0
```

La property reste, la room reste, mais son rate plan a été perdu : la mutation
est partiellement appliquée.

**Conséquence** : perte de configuration, action admin annoncée comme
suppression mais inachevée, historique incohérent et retry non déterministe.

**Solution sans régression** : choisir explicitement une sémantique :

1. **archivage** de property/rooms, recommandé avec historique booking;
2. purge administrative exceptionnelle, transactionnelle, avec stratégie légale
   documentée (anonymisation/retention), jamais depuis le bouton courant.

Dans tous les cas, encapsuler le cleanup dans une transaction et interdire le
hard delete lorsqu’un booking référence encore les entités. Même analyse pour
la suppression bulk de room et la route directe promotions.

---

### AUD-108-06 — La 2FA divulgue le secret TOTP à un tiers et peut être réinitialisée sans réauthentification

**Parcours** : Mon compte → Activer la 2FA.

**Constat source** : `TwoFactorSection` construit une image distante
`https://api.qrserver.com/...data=<otpauth>`. L’URI `otpauth` contient le
secret TOTP. `POST /api/auth/2fa/setup` remplace aussi `twoFactorSecret` et
force `twoFactorEnabled=false` même si la 2FA était active; aucune confirmation
mot de passe/TOTP n’est demandée.

**Conséquence** : un fournisseur QR tiers reçoit le facteur secret et une
session compromise peut abaisser le niveau de sécurité du compte. La 2FA ne
peut être considérée robuste dans cet état.

**Solution sans régression** : générer QR/SVG localement (bibliothèque locale ou
route qui ne sort jamais le secret), conserver une 2FA active jusqu’à validation
d’un nouveau secret, et exiger mot de passe récent + TOTP courant pour
re-provisionner/désactiver. Ajouter tests de non-appel réseau, rotation 2FA et
réauthentification.

---

## P1 — incohérences métier/UX à traiter avant ouverture réelle

### AUD-108-07 — Les réglages sécurité et notifications affichés à l’admin sont pour partie décoratifs

**Constat** : le schéma `app_settings.notifications` expose welcome, confirmation,
rappels J-3/J-1, demande d’avis et newsletter. Une recherche des consommateurs
ne trouve aucun usage de ces flags. Les options `security.minPasswordLength`,
`security.sessionDays` et `security.twoFactorRequiredHosts` ne sont pas
appliquées non plus : auth utilise des constantes (`min 8`, 7/30 jours).

**Conséquence** : l’admin croit gouverner des contrôles qui ne changent aucun
comportement; une exigence 2FA hôte peut être activée sans protection réelle.

**Solution** : soit brancher chaque flag à son effet et créer les jobs manquants,
soit retirer/étiqueter clairement les réglages non actifs. Pour la sécurité,
introduire une fonction centrale de politique lue côté serveur et une migration
progressive des sessions, jamais une simple modification UI.

### AUD-108-08 — L’outbox n’offre pas le même niveau de fiabilité à tous les emails

**Constat** : confirmations booking, alertes et nouveaux messages utilisent
partiellement l’outbox. Inscription, reset password et annulation appellent
encore `getMailer().send()` directement. Les messages sont seulement enqueued;
le seul cron Vercel est quotidien à 08:00, donc une notification de message peut
arriver près de 24 h plus tard.

**Conséquence** : parcours de reset/annulation non rejouables, doublons/pertes
possibles après crash, promesse « nouveau message » tardive.

**Solution** : unifier les emails transactionnels dans l’outbox avec event keys,
priorité et idempotence; tenter une livraison hors transaction juste après
l’enqueue, puis reprendre au cron. Prévoir un worker/queue ou un scheduler
fréquent selon le SLA réellement annoncé.

### AUD-108-09 — La reprise de paiement reste non actionnable pour un voyageur après échec réseau

**Constat** : T-107 conserve le hold et le cron peut créer l’intent, mais si
`POST /api/bookings` répond 503 après une panne provider, l’UI ne reçoit pas de
client secret récupérable ni de parcours « reprendre le paiement ». Réessayer
le formulaire crée un nouveau booking alors que le premier hold occupe encore
le stock.

**Conséquence** : abandon et blocage de capacité pendant le TTL; le correctif
transactionnel est robuste côté serveur mais incomplet côté utilisateur.

**Solution** : persister une tentative de paiement avec identifiant opaque,
exposer un endpoint propriétaire/invité de reprise qui retrouve/crée le même
intent idempotent, et rendre le CTA de checkout réentrant. Le token invité doit
être court, haché en DB et ne jamais exposer l’ID brut.

### AUD-108-10 — Le dashboard messages hôte affiche des lignes cliquables qui n’ouvrent rien

**Constat** : `MessagesManager` rend chaque conversation avec
`cursor-pointer`, mais aucun `Link`, `onClick` ni navigation vers
`/dashboard/messages/[id]`. Cette route existe et est protégée.

**Conséquence** : l’hôte ne peut pas répondre depuis la liste dashboard, alors
que le texte promet « Communiquez avec vos voyageurs ».

**Solution** : envelopper la ligne dans un lien accessible ou ajouter un bouton
« Ouvrir »; préserver les contrôles de rôle déjà présents dans la page détail.
Ajouter un test de rendu avec `href` et un test HTTP hôte du détail.

### AUD-108-11 — Des promesses produit et métriques sont non justifiées

**Constats** :

- accueil : « Prix garantis », « on vous rembourse la différence », « Support
  24/7 » sans mécanisme de claim, SLA ni ticket;
- dashboard messages : « Temps de réponse < 2h » et impact sur visibilité sans
  calcul de délai ni moteur de ranking;
- BestRewards et Mon compte codent en dur 5/15 séjours, -10/-15/-20 et 5 %
  malgré réglages admin dynamiques;
- ReferralCard génère/copie un code, mais inscription/booking ne consomment
  jamais de referral et aucun avantage n’est attribué;
- le type promo « nuit gratuite » est offert au formulaire, mais
  `applyPromoToTotal()` le traite comme un montant fixe arbitraire.

**Conséquence** : promesses commerciales fausses, support coûteux, réglages
incohérents et calcul promotionnel mal compris.

**Solution** : retirer ou formuler honnêtement les promesses sans processus;
source unique des règles BestRewards côté serveur et projection lecture pour
l’UI; implémenter un vrai parrainage avec attribution idempotente ou masquer la
carte; retirer `free_night` jusqu’à ce que le moteur choisisse explicitement la
nuit/rate plan éligible et snapshotte son calcul.

### AUD-108-12 — Reporting financier et checkout ne gèrent pas réellement le multi-devise

**Constats** : room/booking supportent plusieurs devises, mais totaux analytics
et billing additionnent des montants de devises différentes puis les affichent
comme EUR. Le checkout et wallet affichent aussi `€` en dur dans plusieurs
zones. Les revenus sont datés à la création de booking, non au séjour/payout,
et la note analytics inclut des avis non approuvés.

**Conséquence** : KPI, net hôte et décisions financières erronés dès qu’EUR,
XAF, USD ou GBP coexistent; confusion pour le voyageur.

**Solution** : séparer les agrégats par devise (première étape sûre) ou ajouter
un moteur FX daté et un ledger; propager `booking.currency` dans tout checkout;
indiquer clairement la date métier utilisée et filtrer analytics sur avis
`approved`/paiements finalisés. Ne jamais convertir implicitement au formatage.

---

## P2 — intégrité opérationnelle, disponibilité et qualité de parcours

### AUD-108-13 — Invariants room/availability et timezone insuffisants

- un hôte peut réduire quantité/capacités sous les engagements futurs via
  `PUT /api/rooms/:id`; aucune vérification des bookings/availability existants;
- l’API disponibilité accepte une fenêtre GET non bornée;
- cron, fin de séjour, annulation et dates utilisent l’UTC serveur alors que
  `properties.timezone` existe mais n’est pas consommé.

**Solution** : refuser/rendre planifiée toute réduction incompatible, valider les
lignes availability en transaction, borner/paginer GET, et définir une règle
hôtelière par timezone property (`checkOut` local) partagée par cron/lifecycle.

### AUD-108-14 — Conversations et messages exposés au spam/concurrence

`conversations` n’a pas de contrainte unique `(userId, propertyId, bookingId)`;
le select-then-insert concurrent crée des doublons. Un utilisateur connecté peut
aussi ouvrir des fils vides pour une property sans booking et poster des messages
sans rate-limit. L’attachment MIME soumis par le client n’est pas comparé au
MIME enregistré dans `upload_objects`.

**Solution** : index unique adapté aux valeurs NULL (ou clé de conversation),
upsert transactionnel, règles explicites pré-/post-booking, rate-limit message,
et MIME lu uniquement depuis la table upload. Conserver le contrôle participant
et les fichiers privés existants.

### AUD-108-15 — Actions UI inachevées ou trompeuses

- les boutons cœur/partage dans l’en-tête de fiche property sont sans handler;
  le cœur fonctionnel existe seulement sur les cartes;
- le téléchargement facture dormant dans billing est sans handler (invoices est
toujours vide); supprimer ce code jusqu’au moteur comptable;
- `PriceAlertsSection` ne précise pas si une alerte enregistrée est « prix de
  base » ou « séjour contextualisé »;
- la carte de réservation permet de choisir des adultes/enfants au-delà de la
  capacité de la chambre, puis laisse l’API refuser tardivement.

**Solution** : brancher les actions aux composants existants ou les rendre non
interactives; afficher le type de quote; borner les selects avec la capacité de
la room tout en conservant la validation serveur.

### AUD-108-16 — Performance et contrats de listes incomplets

`GET /api/properties` applique une partie des filtres prix/dates/near en JS
**après** `limit/offset`, sans count ni ordre stable. `GET /api/reviews` et
d’autres listes ne bornent/valident pas toujours `limit/offset`. Pages analytics,
billing et conversations chargent l’historique complet ou font du N+1.

**Solution** : réutiliser les prédicats SQL de la page recherche, count et
pagination stable dans les APIs; valider tous les paramètres; introduire des
agrégats SQL/indexes avant tout cache RSC. Ne pas remplacer les filtres par des
approximations client.

### AUD-108-17 — Dette dépendances et couverture de tests

`npm audit --omit=dev` trouve 3 vulnérabilités high de production : `next`
(<16.2.11), `postcss` et `sharp`. Les tests passent mais ne couvrent pas les
scénarios AUD-108-01 à 108-16, et Chromium demeure indisponible dans ce sandbox.

**Solution** : upgrade contrôlé sur branche dédiée avec build/smoke/E2E, tests
RBAC négatifs, tests de saga financière, intégration 2FA sans réseau tiers et
un vrai navigateur CI. Ne pas utiliser `npm audit fix --force` aveuglément.

---

## Ordre de remédiation proposé

1. **T-108 niveau C/P0** : publication/detail/reviews RBAC, finance bulk,
   suppressions atomiques, 2FA sûre, réglages sécurité effectifs.
2. **T-109 niveau C/P1** : saga annulation/reprise paiement, outbox unifiée,
   messages dashboard/anti-spam, devise/reporting et règles de timezone.
3. **T-110 niveau S/P2** : cohérence BestRewards/referral/promos, actions UI,
   performance/pagination API, upgrade dépendances et E2E CI.

Chaque chantier doit commencer par une matrice de compatibilité des anciens
bookings, URLs, messages, rate plans, providers et migrations. Aucun correctif
ne doit modifier rétroactivement un snapshot booking ou présenter un email,
remboursement, payout ou facture comme effectif sans preuve fournisseur.
