# 📓 Journal de développement

Notes libres, une entrée par intervention. Antéchronologique (la plus récente
en haut). Aucun format imposé — quelques lignes suffisent : ce qu'on a fait,
ce qu'on a appris, ce qu'on laisse pour la prochaine fois.

---
## 2026-09-11 — Audit n°5 (exécution) : parcours métier et fins de parcours

**Fait.** Cinquième passe d'analyse à l'exécution (aucune ligne de code produit modifiée) :
rejeu des scénarios métier (promos valide/minuscule/sous minimum/inconnue, stop-sell de bout
en bout — recherche 8 → 7, devis et réservation 409 —, réponse d'hôte publiée puis retirée,
heure d'arrivée dans les 2 e-mails, alerte de prix créée puis supprimée par la route de l'UI,
disponibilité de chambre posée par l'hôte propriétaire) et attaque de surfaces jamais sondées
(volumétrie des écrans de liste, cycle de vie complet d'une liste de favoris, saisie des motifs
de modération, traçabilité du wallet, supervision des crons). Huit constats A1→A8 documentés dans
`docs/analyse_2026-09-11_audit_runtime_execution.md` (copie `REPORTS/analyse_runtime_n5_2026-09-11_execution.md`),
tâches **T-245 → T-252** au BACKLOG, base remise à l'état seed (contrôles SQL).

**Appris.**
1. Deux « 405 » et un « 400 » de la campagne d'échantillonnage étaient **mes** erreurs, pas celles du
   site : le `DELETE` des alertes prix passait par la collection (l'UI utilise `/[id]`, qui répond 200),
   et `PUT /rooms/[id]/availability` attend un lot `{ days: [...] }`. Vérifier le corps attendu et la
   route réellement appelée **avant** de conclure à un bouton cassé.
2. Une route sans `fetch` appelant n'est pas morte : `/api/auth/verify` est le **lien cliquable**
   construit dans les e-mails d'inscription. Grâce aux recherches d'appelants littéraux, les routes
   « invisibles » doivent être recoupées avec les chaînes interpolées des gabarits d'e-mails.
3. Les défauts les plus utiles trouvés cette fois ne sont pas des bugs mais des **fins de parcours** :
   un multi-listes qui ne permet pas de choisir sa liste, des tableaux qui chargent tout, un motif de
   modération facultatif côté API alors qu'il est demandé à l'écran, un tri ignoré sans bandeau, un
   wallet crédité sans journal, des crons sans trace. Le socle métier, lui, tient à l'exécution.
4. Une fonctionnalité « désactivée » (wallet non dépensable depuis T-207) reste un **choix produit à
   documenter** : l'observation O1 du BACKLOG a été reprise en tâche T-248 avec la mesure du problème
   (4 familles d'écriture, 21 mutations de solde, aucun journal).

**Correctifs courts dans la foulée.** Trois constats corrigés immédiatement, choisis pour leur faible
risque : T-249 (bandeau « tri ignoré » — le dernier filtre avalé sans avertissement), T-251
(messagerie : `not_found` et `forbidden` enfin distingués, comme le faisait déjà la page) et T-252
(suppression du code mort de T-207 + documentation de `useWalletCredits`). Aucun des trois ne touche un
montant, une transaction ou un contrat d'API existant.

**Prochaine fois.** Implémenter dans l'ordre T-247 (dialogue de motif) → T-245 (pagination) →
T-246 (favoris) → T-250 (supervision des crons), et trancher d'abord la consommation du wallet
(avoir sur règlement sur place ou gel assumé) avant T-248.



**Fait.** Les onze constats A1→A11 (audit n°2) et les trois constats N1→N3
(audit n°4) sont implémentés et validés. Ordre suivi : A1+A2 (échéance des
demandes, séjours échus non réglés) → A6+A7+A8 (édition de chambre, horaires
d'arrivée et fuseau, labels administrables) → A3+A4 (interrupteurs d'e-mails,
parrainage réglable) → A5+A9+A10+A11 (avis notifiés, libellé du fil par acteur,
suspension distincte de la suppression, codes de secours 2FA) →
T-242+T-243+T-244 (anonymisation complète, purge technique, stock vendable).

**Appris.**
1. Un état métier ne doit pas partager sa colonne avec un autre : suspension et
   suppression écrivaient toutes deux `deleted_at`, si bien qu'un compte
   anonymisé affichait « Suspendu » avec un bouton « Réactiver » — et que la
   réactivation le faisait réapparaître sous `deleted-…@anonymized.local`.
   Séparer `suspended_at` a rendu les deux messages de connexion exacts (motif de
   suspension vs compte supprimé irréversible).
2. Une échappatoire de sécurité doit être aussi testée que le verrou : les codes
   de secours 2FA sont vérifiés en bout en bout (activation → connexion avec un
   code → refus du même code réutilisé → désactivation par code de secours), car
   un code réutilisable serait une régression silencieuse du second facteur.
3. Un formulaire qui accepte une valeur sans la valider produit une
   configuration incohérente : `14:00 → 14:00` (fenêtre d'arrivée vide) passait en
   `200`. La validation se fait désormais sur l'**état résultant** d'une mise à
   jour partielle, sans bloquer les fenêtres à cheval sur minuit (18:00 → 02:00).

**Non retenu.** Bloquer les fenêtres d'arrivée traversant minuit : c'est une
pratique hôtelière courante, seule la fenêtre vide est refusée. Également écarté
d'ignorer silencieusement les labels envoyés par un hôte en POST : le refus
explicite (`403`) évite de laisser croire que le badge a été appliqué.

**Preuves.** `npm run ci` verte · **vitest 691 tests / 117 fichiers** (0 échec) ·
`ai:check` · runtime serveur réel (parcours 2FA complet, suspension/réactivation
puis refus 409, horaires/fuseau persistés, labels 403, purge technique, stock
« reste X »). Base remise à l'état seed (8 users / 8 props / 31 bookings /
22 avis).

---
## 2026-09-10 — T-217 correctifs P1–P10 (audit runtime)

### Complément T-217 (même journée)

**Fait.** Balayage exhaustif des surfaces `notFound()` en production (10 pages,
14 sondes → 404 ; contreparties valides → 200), vérification bout en bout du
reçu voyageur (200 / 403 / 401 / 200), confirmation que la page de détail d'un
fil vide guide déjà l'utilisateur, et clarification des deux exports CSV
(« versements » vs « réservations »).

**Appris.** Une correction de statut HTTP ne se prouve pas par échantillon :
seules les 10 pages concernées, testées une par une, ferment le sujet. Autre
point : les deux exports CSV partageaient leur libellé — un utilisateur ne
pouvait pas savoir lequel il téléchargeait, alors que les routes étaient bien
distinctes.

**Non retenu.** Notifier l'hôte à la création d'un fil vide : le message lui
envoyé suffit (aucun e-mail sans contenu) — le rattrapage du fil non écrit passe
par la fenêtre de 7 jours de P7.


**Fait.** Mise en œuvre des dix constats de
`docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md` : squelettes de
chargement feuilles (fin du soft-404), édition d'hébergement rendue côté
serveur, section « Avis » (modération), reçus sur les séjours passés, carte
« Versements et relevés », édition des promotions, accès direct à l'édition
d'une chambre, fil de messagerie vide visible 7 jours, journal d'audit paginé,
entrée « Chambres » dans la navigation admin.

**Appris.** Le soft-404 ne venait d'aucune page mais du `loading.tsx` **racine** :
toute frontière Suspense au-dessus d'une route `[id]` fige le statut à 200.
Corollaire : un `loading.tsx` ne doit être posé que sur des feuilles sans enfant
dynamique — la règle est écrite dans `page-loading.tsx` pour ne pas la
redécouvrir. Autre leçon : une assertion smoke peut dépendre d'un bug (ici le
soft-redirect de `/maintenance`) ; quand le statut redevient correct, l'assertion
doit décrire les deux issues réelles (200 actif / 307 inactif) au lieu d'être
« ajustée » au hasard.

**Pour la suite.** Sujets résiduels : notification e-mail à la création d'une
conversation, export CSV de la carte billing, préférences de notification par
utilisateur.

## 2026-09-10 — T-208 audit fonctionnel/runtime post T-207

**Fait.** Reprise de l'audit runtime demandé : build production, seed, smoke,
site-audit, run_all_sims, dashboards_sim et probes ciblés sur `/connexion`,
`/reservation`, `/mes-reservations`, billing/settings, stock pending et outbox.
Rapport livré : `.ai/REPORTS/audit_fonctionnel_profond32_T208_2026-09-10.md`.
Aucun code produit n'a été modifié dans cette passe.

**Appris.** Le modèle sans paiement plateforme est bien fermé côté UI/runtime, mais
il déplace le risque vers l'opérationnel : les demandes `pending` sans expiration
peuvent bloquer l'inventaire indéfiniment, et la demande initiale n'envoie pas
d'email aux parties. Deux autres sujets sont surtout gouvernance/produit : les
identifiants démo publics (admin inclus) et le bouton seed public sur accueil vide.
Le harnais `dashboards_sim.py` est en retard sur le soft-delete des chambres.

**Contrôle final.** `npm run ai:check && git diff --check` vert : 20 OK / 0 warn /
0 fail, aucune erreur whitespace.

**Laissé.** Findings à implémenter par priorité : F1 TTL/stock des demandes,
F2 notifications de demande, F3/F4 flags démo, F5 flag payout legacy, F6 QA,
F7 feedback discret des fetchs silencieux.

---
## 2026-09-10 — T-207 réservations sans paiement plateforme

**Fait.** Audit runtime orienté parcours : le tunnel `/reservation`, les actions
`/mes-reservations`, l'API booking/payment, l'exposition Stripe navigateur, le
wallet, les pages aide/compte/légal/RGPD et les surfaces billing/settings ont été
alignés sur une politique unique : **MyBestBooking ne conduit plus le voyageur vers
un paiement en ligne**. Le POST booking crée une demande `pending` sans intent PSP,
la route legacy `/api/bookings/[id]/payment` répond `410`, le CTA « Payer
maintenant » disparaît, `StripePaymentForm` est un stub et le wallet n'est plus
débité dans le tunnel.

**Appris.** Supprimer un paiement ne suffit pas côté UI : il faut également fermer
les chemins de reprise et clients forgés. La garde serveur (`payOnline` ignoré,
`payment:null`, `onlinePaymentDisabled:true`) est le vrai invariant ; la garde UI
(`shouldShowStripeForm=false`) évite qu'une réponse legacy contenant un
`clientSecret` réactive une carte. Les surfaces pro (billing/payout/settings) ne
devraient plus suggérer des versements quand la plateforme n'encaisse pas.

**Validé.** `typecheck`, `lint`, `i18n:check` (0 candidat), tests ciblés 23/23,
`npm test` 558 pass / 17 skip, build 65 pages, smoke 95/95, site-audit 260 pages /
0 issue, run_all_sims 399 OK / 4 WARN / 0 KO, DB reset, `ai:check` 20 OK / 0 warn / 0 fail et `git diff --check` OK. Un premier site-audit sous
`next dev` a été interrompu par arrêt serveur ; la preuve retenue est le relancement
sous `next start`.

**Laissé.** Les modules Stripe/payment/payout historiques restent en compatibilité
technique et tests legacy, mais ne sont plus exposés au parcours voyageur ni au
billing actif.

---
## 2026-09-09 — T-206 audit fonctionnel/runtime profond post T-205

**Fait.** Audit runtime/fonctionnel relancé après T-205 : build prod OK, crawl
site-wide OK (242 pages / 0 issue), runner complet exécuté puis expliqué (surface
KO car il attend encore `confirmed` alors que le flux manuel est `pending`, deep
KO car il ne suit pas `account-client.tsx`). J'ai ajouté le rapport
`.ai/REPORTS/audit_fonctionnel_profond31_T206_2026-09-09.md`.

**Appris.** Les sondes ciblées ont révélé quatre sujets à traiter en priorité :
(1) le calcul POST booking diverge du devis sur invité + rate plan + promo
(BestRewards appliqué à tort à l'invité et remise rate plan absente du champ
`discount` dès qu'une promo existe) ; (2) un hôte peut clôturer `completed` une
réservation `paymentStatus=pending`, ce que le cron refuse pourtant ; (3) le
`PUT` générique d'une property peut publier un bien d'hôte non approuvé ; (4) le
mode maintenance protège les pages mais pas toutes les écritures API.

**Laissé.** Aucun code T-206 n'est modifié pour l'instant : le prochain tour doit
faire les analyses d'impact/conception de correction, puis traiter les lots F1-F4
en premier sans casser T-205.

---
## 2026-09-07 — T-204 mise en œuvre des remarques (garde P3 + preuves e-mails)

**Fait.** Après l'audit T-203, l'utilisateur a demandé d'implémenter les remarques
restantes du framework `.ai/` sans régression. Deux points ouverts :

1. **P3 — machinerie Stripe orpheline** (`StripePaymentForm`, `pendingStripePayment`).
   Elle était jugée inatteignable par le flux manuel, mais **aucun garde** ne
   l'interdisait formellement. → J'ai extrait la décision dans
   `shouldShowStripeForm` (`src/lib/booking-flow.ts`) : une réponse
   `manualConfirmation:true` ne peut jamais afficher l'UI carte, même si le serveur
   renvoyait un `payment`. Appliqué à `handleSubmit` ET `resumePaymentFor`. Testé
   5/5. La machinerie reste mais est désormais **inatteignable et prouvée** (reprise
   d'un booking manuel sur `/api/bookings/[id]/payment` → 409).
2. **E-mails non re-testés au runtime** (annulation + price-alert). → Re-testés :
   annulation = **2 mails réels** (voyageur fr + hôte en, eventKeys distincts) ;
   price-alert = **1 mail fr réel** (nouveau test d'intégration `price-alert-mail.test.ts`),
   idempotent (2 enqueues → 1 ligne outbox).

**Appris.** Les 17 tests vitex « skippés » dans `npm run ci` (`admin/bulk`,
`admin/hosts`) sont des tests **serveur-live** : ils ignorent le serveur Next s'il
n'est pas actif. En les relançant avec le serveur actif, ils passent 17/17 → le
total réel est **554 tests**, identique à avant la session : **aucune régression de
couverture**.

**Laissé.** La machinerie Stripe n'est pas supprimée (hors périmètre) mais
documentée dans `KNOWN_LIMITATIONS.md` comme inoffensive et gardée.

---
## 2026-09-07 — T-203 audit e-mails (P7 : confirmation manuelle)

**Fait.** L'utilisateur m'a demandé de tester l'intégralité du site et de dire
si les e-mails sont complets et fonctionnels. Le test d'intégralité était déjà
vert (`npm run ci`), mais l'audit runtime des e-mails a révélé un **vrai trou** :

> La confirmation de réservation ne partait que depuis le flux de paiement en
> ligne (`payment-intents.ts` — webhook Stripe / Paiement). Quand l'hôte
> **confirme à la main** une réservation à payer sur place (scénario T-202/T-203),
> **aucun e-mail** n'était envoyé (outbox vide, `confirmation_email_sent_at` NULL).

**Cause.** `sendBookingConfirmationIfNeeded` exigeait `status:"confirmed"` **ET**
`paymentStatus:"paid"`. Or en paiement sur place, la confirmation hôte survient
avec `paymentStatus` encore `pending`. Et personne ne l'appelait depuis le PUT.

**Correctif.**
- `PUT /api/bookings/[id] {status:"confirmed"}` → appelle
  `sendBookingConfirmationIfNeeded(id)` (best-effort, post-commit).
- La fonction ne conditionne plus l'envoi à `paymentStatus:"paid"` : garde sur
  `status:"confirmed"` + `confirmationEmailSentAt` (idempotence) + toggle
  admin `notifications.bookingConfirmation` (désormais respecté).

**Appris.** Le plus dur n'était pas le code mais de **prouver** le manque :
le smoke ne teste pas la confirmation (POST → `pending`), donc un gap pouvait
traverser toute la CI. Seul le runtime (serveur + outbox) a montré le trou.
P3 en bonus : l'écran de confirmation disait « C'est confirmé ! / Total payé »
pour une résa manuelle encore `pending` — corrigé avec 3 clés i18n.

**Laissé pour plus tard.** R7 warn (STATE HEAD) tant que le commit de doc n'est
pas fait ; les toggles `bookingReminder*`/`reviewRequest`/`bookingConfirmation`
sont des clés schema mais pas toutes exposées en UI d'admin.


## 2026-09-07 — T-203 correction du scénario « paiement manuel »

**Fait.** La revue bout-en-bout du flux manual_confirm de T-202 a révélé 4
divergences qui cassaient le scénario ; toutes corrigées sans toucher au tunnel
Stripe/PSP ni au webhook.

- **1. Versements/revenus inertes** : une réservation manuelle restait
  `paymentStatus:"pending"` pour toujours et `paymentMethodOffline` n'était jamais
  `true` → le pipeline `payout` (filtre `paid`) ne produisait rien. Ajouté
  `PUT /api/bookings/[id] {markPaidOffline:true}` (hôte/admin) → `paid` + `offline`
  + audit `booking.pay.offline`. Résolution : **ne pas modifier** le filtre `paid`
  de `payout-service`/`dashboard` — rendre l'état `paid` atteignable.
- **2. Expiration abusive** : le cron annulait la demande manuelle après 15 min.
  → `paymentExpiresAt:null` sans `payOnline` ; cron limité aux `paymentIntentId`.
- **3/4. UI** : bouton/badge « Payé sur place » + masque « Payer maintenant ».
- **Leçon** : quand on désactive une automatisation (paiement auto), il faut
  fournir le **contre-équivalent manuel** complet (le "constater payé"), sinon le
  pipeline aval (payout/revenus) se retrouve en état mort. Et un cron d'expiration
  pensé pour un hold de paiement doit être re-borné quand le paiement devient optionnel.

## 2026-09-07 — T-202 validation hôte + paiement manuel

**Fait.** Ajout de la validation hôte à l'inscription (admin approuve + fixe un %
de commission) et bascule vers un paiement manuel (plus de paiement auto, statuts
gérés à la main par l'hôte).

- **Socle DB** : colonnes additives `users.approvalStatus`/`commissionRate`,
  `bookings.paymentMethodOffline`/`confirmedBy` (migration 0019, non destructrice).
- **Approbation** : helper `host-approval.ts` (gate), routes `/api/admin/hosts[/id]`,
  UI une `HostApproveActions`. Gate de publication : un hôte non approuvé ne peut
  pas passer `active` (`/validate` → 409).
- **Commission** : `commission.ts` avec priorité propriété > hôte > global ; les
  propriétés existantes gardent leur taux (zéro régression).
- **Paiement manuel** : `POST /api/bookings` → `payment:null`, `manualConfirmation:true`,
  `status:"pending"`. Le webhook ne force plus `confirmed`.
- **Statuts** : `booking-lifecycle` `host_all` (l'hôte confirme `pending→confirmed`),
  route `bookings/[id]` enregistre `confirmedBy`.

**Leçon.** La bascule "paiement auto → manuel" est délicate pour le parcours client.
En gardant la route `/api/bookings/[id]/payment` (back-office) et en ne désactivant que le
déclenchement automatique, on ne casse rien : la réservation se crée toujours (201),
juste `pending`. Le champ `payOnline` (optionnel) permet de réactiver le paiement en ligne.

**Gates.** tsc 0 · lint 0 · i18n 0 (catalogue **1477**) · vitest **546/546** ·
build 64 · smoke 95/95 · ai:check 19 OK · 0 fail.

---

## 2026-09-07 — Versements : correctifs P6–P9 (UX/sémantique)

Suite au rapport `analyse_gaps_restants_P6P9_2026-09-07.md`, j'ai bouclé les
écarts **UX/sémantique** laissés par P1–P4 (qui étaient des régressions internes
déjà corrigées) :

- **P6** — le bouton `PayoutRequestButton` prend désormais `currency`
  (optionnelle) et le `POST /api/host/payouts` filtre par devise (`currency` dans
  le body Zod) → un clic sur la ligne EUR ne déclenche plus le XAF. Un `currency`
  sans payout correspondant → 404 (testé runtime).
- **P7** — garde-fou devise **visible** : le bouton consomme `skipped[]`
  (`payouts.skippedCurrency`) et `hasAccount===false` (`payouts.accountMissing`)
  au lieu d'un simple `reload()` silencieux.
- **P8** — la carte « Factures » (versements) pointe ses exports vers
  `/api/dashboard/billing/export-payouts`, **plus** vers `/export` (bookings,
  réservé à la carte Réservations).
- **P9** — nouvelle route `GET /api/dashboard/billing/export-payouts` : CSV du
  ledger `payouts` (période, devise, brut, commission, net, réservations,
  statut, versé le, idempotence), host/admin, 500 max, en-têtes `billingCsv.*`.

**Leçon** : sur une fonctionnalité déjà validée, les écarts peuvent être purement
« le serveur sait mais l'UI ne le montre pas ». La clé est de rebrancher l'état
(`skipped`, `hasAccount`, `currency`) du contrat existant dans l'UI — les ajouts
restent **additifs** (aucun paramètre requis), zéro régression.

Gates : tsc 0 · lint 0 · i18n 0 (catalogue **1462**) · vitest **536/536** ·
build 63 · ai:check 19 OK · 0 fail.

---

## 2026-08-20 — Réécriture complète de `.ai/`

**Contexte.** Le dossier `.ai/` initial décrivait un tout autre projet
(« MobileCaisse », app Android Kotlin de caisse enregistreuse) et imposait un
cadre de gouvernance lourd (Docker obligatoire, §13/§14/§15/§16/§17/§22,
rôles multiples, `blocking_rules`, double-validation, `CURRENT_TASK.md` unique
et bloquante…).

**Ce qu'on a fait.** Suppression intégrale de l'ancien contenu et création
d'un nouveau `.ai/` :

- Aligné sur **MyBestBooking** (Next.js + PostgreSQL + Drizzle).
- **Sans gate** : aucun document ne bloque un commit, une PR ou un
  déploiement. Les checklists sont fournies à titre d'aide-mémoire.
- Structure allégée : `README`, `PROJECT`, `ARCHITECTURE`, `DATABASE`, `API`,
  `UI`, `SECURITY`, `CODING_STYLE`, `DEV_ENVIRONMENT`, `DEPENDENCIES`,
  `BUGS`, `BACKLOG`, `ROADMAP`, `DEVLOG` + dossiers `PROMPTS/`,
  `CHECKLISTS/`, `ADR/`, `REPORTS/`, `LOGS/`.

**Pour la suite.** Voir `BACKLOG.md` — les items 🔴 sont les prérequis
sécurité/exploitation avant tout déploiement réel.

---

## 2026-09-09 — T-205 audit fonctionnel/runtime

T-205 livré et validé : corrections additifs des parcours runtime (réservation/paiement, disponibilité, hôte, modération, messagerie admin, billing, référentiels, calendrier, soft-delete chambres, wishlists/analytics). Point notable : ajout de `GET /api/bookings/quote` pour que le checkout affiche le même calcul que `POST /api/bookings` lorsque le calendrier surcharge les prix par nuit.

Gates : `npm run typecheck` 0 · `npm run lint` 0 · `npm test` 455/455 (113 skipped DB-gated) · `npm test -- src/app/api/bookings/quote/route.test.ts` 2/2 avec DB locale · `npm run i18n:check` 0 · `npm run build` 65 pages · `npm run smoke` 95/95 · `npm run ai:check` 19 OK, 1 warn R7, 0 fail.

## 2026-09-10 — T-206 implémentation findings runtime

**Fait.** Implémentation des 13 remarques T-206 après impact/conception/débat niveau C.

- **Finance/réservation** : correction du cumul `discount` (rate plan + promo), suppression de la remise BestRewards pour invités anonymes, verrou promo `FOR UPDATE` dans la transaction.
- **Paiement/lifecycle** : confirmation manuelle préservée, online unpaid non confirmable, `completed` interdit tant que non payé pour éviter cashback/loyalty indus.
- **Catalogue/recherche** : helper `future-stay`, 0 résultat sur séjour demandé impossible, API alignée sur SSR (`amenity`, amenities chambres, `displayCurrency`).
- **Sécurité opérationnelle** : garde maintenance sur mutations non-admin, UUID invalides en 400, publication active soumise au gate hôte approuvé même via PUT générique.
- **UX/ops** : enfants bornés sur fiche, conversations vides masquées, lien admin messagerie, suppression compte avec obligations, facture unpaid déclassée en reçu non soldé.
- **QA** : simulations surface/deep/paranoid actualisées ; reset DB nettoie les artefacts T-206.

**Validation.** `npm run typecheck` 0 · `npm run lint` 0 · `npm run i18n:check` 0 · tests ciblés T-206 12/12 · `npm test` 561 pass / 17 skip · `npm run build` 65 routes · `npm run smoke` 95/95 · `site:audit` 249/0 · `run_all_sims.py` 399 OK / 4 WARN / 0 KO · `npm run ai:check` 20 OK / 0 warn / 0 fail.

---

## 2026-09-10 — T-209 implémentation des remarques T-208

**Fait.** Les 7 remarques issues de l'audit runtime T-208 ont été implémentées en conservant la contrainte T-207 : le parcours voyageur ne propose toujours aucun paiement plateforme.

- **F1/F2 réservation** : migration additive `request_expires_at`, TTL configurable borné (24h par défaut), création `POST /api/bookings` en demande manuelle avec `payment:null` + emails outbox voyageur/hôte ; cron d'expiration conservateur qui ne cible que `pending` sans `payment_intent_id`.
- **F3/F4 démo** : flags publics pour afficher les accès démo/seed, opt-in serveur obligatoire en production (`DEMO_LOGIN_ENABLED`, `DEMO_SEED_ENABLED`) et conservation de la garde `SEED_TOKEN`.
- **F5 payouts** : les surfaces mutables legacy sont neutralisées par défaut (`410 PLATFORM_PAYOUTS_DISABLED` ou webhook accepté sans mutation) ; l'historique en lecture/export reste disponible.
- **F6/F7 QA/obs** : simulation dashboards réalignée sur le soft-delete rooms ; fetchs silencieux client avec trace console discrète et dédupliquée.

**Validation.** `npm run typecheck` 0 · `npm run lint` 0 · `npm run i18n:check` 0 · tests ciblés 43/43 · `npm run test` 575 pass / 17 skip · `npm run build` 65 pages · `npm run smoke` 95/95 · `python3 scripts/dashboards_sim.py` 68 OK / 0 KO · `python3 scripts/run_all_sims.py` 400 OK / 4 WARN / 0 KO · `npm run site:audit` 269 pages / 0 issue. Un premier smoke a révélé que le script ne relisait pas `SEED_TOKEN` depuis `.env.local` en production preview ; le harnais a été corrigé, sans assouplir la garde API. `run_all_sims.py` charge aussi `.env.local` pour ses sous-process Next et est désormais protégé par `if __name__ == "__main__"`.

## 2026-09-10 — T-210 audit runtime complémentaire + filtre accueil

**Fait.** Le filtre de la page d'accueil est maintenant une entrée rapide destination seule : suppression de `checkIn`, `checkOut`, `guests` et `home-guests` dans le hero, conservation de `action="/recherche"` + `city`.

**Préservé.** `/recherche` garde les filtres avancés, la fiche garde la sélection de dates/voyageurs, `/reservation` garde le devis/demande sans paiement plateforme. T-207 reste intact : aucune carte, aucun Stripe public, aucun CTA « Payer maintenant ».

**Audit.** Les parcours runtime repassent sans nouveau défaut bloquant : smoke 95/95, simulations 402 OK / 0 WARN / 0 KO, site-audit production 247 pages / 0 issue. Résiduels proposés au backlog : wrapper `site:audit:prod`, carte recherche optionnelle, staging providers réels, E2E navigateur.

---

## 2026-09-10 — T-211 wrapper `site:audit:prod`

**Fait.** Ajout d'une commande QA reproductible pour éviter les faux rouges du long crawl sous `next dev`/Turbopack :

- `scripts/site-audit-prod.mjs` orchestre `next build`, `next start`, l'attente `/api/health`, le crawl `scripts/site-audit.mjs`, puis le cleanup du serveur.
- `package.json` expose `npm run site:audit:prod` sans modifier `npm run site:audit`.
- Le port est configurable (`SITE_AUDIT_PROD_PORT`, `--port`) avec défaut 3100 et recherche automatique si le port par défaut est occupé ; `--skip-build` permet de réutiliser un build existant.

**Validation.** `node --check scripts/site-audit-prod.mjs` OK · `npm run site:audit:prod` : build 65 pages, serveur `next start`, crawl 247 pages / 0 issue, serveur arrêté · `npm run lint` 0 · `npm run typecheck` 0 · `npm run i18n:check` 0 · `npm run test` 577 pass / 17 skip · `npm run ai:check` 20 OK / 0 warn / 0 fail · `git diff --check` OK.

## 2026-09-10 — T-215/T-216 commission hôte éditable + statuts dans la liste

**Fait.** Deux évolutions issues de l'analyse produit du 2026-09-10, plus un correctif réel.

- **T-215** : l'admin édite le taux de commission d'un hôte **pour tout statut** depuis `/dashboard/users` (champ vide = héritage du taux global), avec impact affiché et propagation **explicite** aux hébergements (`inherited` / `listed`). `PATCH /api/admin/hosts/[id]` gagne l'action additive `updateCommission` et `GET` expose l'état en lecture seule. Corrige BUG-050 (`propertyCount` toujours nul).
- **T-216** : la colonne Statut de `/dashboard/bookings` offre les transitions réellement acceptées par le serveur (confirmer une demande, annuler, clôturer après départ), avec confirmation et audit `booking.status.update`. `PUT /api/bookings/[id]` reste l'unique source de vérité.

**Préservé.** Approbation hôte (T-202), paiement manuel et `markPaidOffline` (T-203), snapshots de commission des réservations vendues, bulk admin, FSM complète, i18n FR/EN (+16 clés = 1532), page détail réservation.

**Validation.** `npm run typecheck` 0 · `npm run lint` 0 · `npm run i18n:check` 0 · `npx next build` 65 pages · `npx vitest run` 107 fichiers / 642 tests (0 échec) · runtime API : `propertyCount` 8, propagation `listed`/`inherited`/reset, erreurs 400/403/404, audits en base, `pending→confirmed` 200, clôtures 400/409/200, terminal 400 · `npm run ci` verte (smoke 95/95) · `ai:check` 19 OK.

## 2026-09-10 — Audit runtime n°2 : fonctionnalités inachevées ou mal pensées (analyse seule)

**Fait.** Deuxième passe d'analyse à l'exécution sur l'application complète, livrée sous forme de
document (`docs/analyse_2026-09-10_audit_runtime_inacheves.md`) et d'entrées BACKLOG **T-221 →
T-231** (+ 6 observations).

**Méthode.** Jetons frais pour les 4 profils, crawl des 43 pages et des 67 routes API, suivi de
261 liens internes (0 cassé), confrontation du registre `src/lib/settings.ts` aux sections
réellement rendues par `settings-panel.tsx`, inventaire des `enqueueEmail` par événement, puis
sondes : `POST /api/bookings` (échéance `requestExpiresAt` présente côté API, absente de l'UI),
expiration par cron sans e-mail, `PUT /api/conversations` par rôle (admin 403 / hôte 201),
suspension → 401 explicite → réactivation, suppression de compte → anonymisation → réactivation
admin (compte « zombie »), constat de paiement conditionnant la clôture.

**Constats principaux.** (1) échéance des demandes de réservation invisible et expiration
silencieuse ; (2) séjours échus non réglés sans vue ni relance ; (3) réglages d'e-mails sans UI ;
(4) parrainage non réglable ; (5) avis sans notification ; (6) édition de chambre incomplète ;
(7) horaires d'arrivée/départ inéditables ; (8) labels/badges non administrables (badge « Éco »
inatteignable, `isBestrewards` aléatoire dans le seed alors qu'il change la remise) ;
(9) « Écrire à l'hébergeur » faux dans le back-office ; (10) suspension ≡ suppression ;
(11) 2FA sans codes de secours ni reset support.

**Préservé.** Aucun code produit, aucune migration, aucune donnée conservée : les réservations,
comptes et fils créés par les sondes ont été supprimés et la base est revenue à l'état seed.

**Validation.** `npm run ai:check` 19 OK / 1 warn (R7, levé par `docs(state)` après commit) /
0 fail ; arbre de travail = document + docs `.ai` uniquement.


### 2026-09-10 — Audit n°3 : scénarios runtime

**Livré.** `docs/analyse_2026-09-10_audit_runtime_scenarios.md` — 13 constats F1→F13, tous
reproduits au runtime : (F1) dates de séjour à J-1 selon le fuseau (UTC « 24 septembre » vs
Los Angeles « 23 septembre » ; lecture `pg` d'une `date` dépendante du fuseau serveur) ;
(F2) hôte suspendu dont la fiche et la recherche restent servies (200) alors qu'il ne peut plus
se connecter ; (F3) demande en attente bloquant les dates (409 sur une 2ᵉ demande) sans
expiration paresseuse ; (F4) quota 10/h compté avant validation (429 sur une demande pourtant
correcte) ; (F5) heure d'arrivée collectée et jamais affichée ; (F6) rejet d'annonce sans e-mail
ni motif lisible ; (F7) page de wishlist partagée sans `noindex` ; (F8) page Confidentialité
promettant un désabonnement inexistant ; (F9) fuseaux horaires décoratifs et non validés ;
(F10) « aujourd'hui » UTC croisé avec un `toDate()` sensible au fuseau serveur ; (F11) suppression
anonymisée confondue avec la suspension ; (F12) analytics sans période ni export ; (F13) champs
inconnus acceptés en 200 et première erreur de validation seule.

**Écarté (vérifié OK).** 0 bouton mort, 0 lien cassé sur 124, messages de validation explicites,
champs invité verrouillés pour un compte connecté, « écrire à l'hébergeur » passant par la
messagerie interne, `/reservation` sans paramètres géré, livraison d'e-mails effective quand le
cron tourne, 403 homogènes.

**Préservé.** Base remise à l'état seed exact (8 users / 8 biens / 33 réservations / 24 avis ;
compteurs 0 ; 1 `app_settings`) ; scripts de sonde supprimés ; arbre de travail hors bruit
`next-env.d.ts`.

**Suites.** T-232 → T-241 au BACKLOG (ordre : dates/fuseaux → annonces → tunnel → confiance →
finitions).

### 2026-09-10 — Audit n°4 : profondeur (cloisonnement, cycle de vie, stock)

**Livré.** `docs/analyse_2026-09-10_audit_runtime_profondeur.md` — nouvelle passe qui rejoue le
moins possible : matrice de permissions (24 cas × 5 identités, dont un second hôte créé pour la
mesure), cycle de vie des données personnelles, rétention technique, stock affiché vs vendable.

**Constats nouveaux.** (N1) la suppression de compte n'anonymise que `users` : les copies
`bookings.guest_*`, `email_outbox.to` et `audit_log.metadata.targetEmail` gardent l'adresse
d'origine ; (N2) aucune purge des sessions expirées, des e-mails livrés ni du journal d'audit —
le cron ne nettoie que les uploads orphelins ; (N3) `GET /api/rooms/[id]/availability` renvoie le
stock **déclaré** sans retirer les séjours (prouvé : 2 affichés pour 1 réellement libre), alors
que le tunnel applique bien les chevauchements — l'information de gestion est fausse, pas
seulement incomplète.

**Confirmations chiffrées.** Dates/fuseaux (décalage J-1 selon le fuseau de lecture, `toDate()`
sensible au fuseau serveur), suspension d'hôte (catalogue 200 + annonces dans la recherche, et
demandes en attente laissées vivantes), demande en attente bloquante jusqu'au cron, quota compté
avant validation (429 sur une demande correcte), heure d'arrivée jamais restituée, fuseau
décoratif avec liste fermée de 10 valeurs face à une API qui accepte tout, analytics figé.

**Écarté (vérifié OK).** Cloisonnement inter-tenant correct sur les 24 cas (factures, messages,
brouillons, chambres, exports, admin, wishlists privées) ; sessions révoquées à la suspension, à
la suppression et au changement de mot de passe ; bénéfices rendus exactement une fois à
l'annulation ; `POST /api/seed` fermé hors environnement démo ; mode sombre réellement stylé ;
aucune route orpheline hormis le tombeau 410 du paiement en ligne (T-207).

**Préservé.** Base à l'état seed exact (8 users / 8 properties / 33 bookings / 24 reviews,
0 conversation / wishlist / outbox / audit) ; scripts de sonde supprimés.

**Suites.** T-242 → T-244 au BACKLOG ; les confirmations enrichissent T-227, T-232 → T-236,
T-241.

## 2026-09-10 — T-232/T-233/T-234 (audit n°3) : dates, suspension d'hôte, expiration paresseuse

**Demandé.** Poursuivre la mise en œuvre des audits après la livraison T-221→T-231 / T-242→T-244 :
traiter les constats F1/F9/F10 (dates et fuseaux), F2 (suspension d'hôte sans effet sur ses annonces)
et F3 (demande expirée bloquant les dates), « sans régression, sans casser l'existant, tout testé
avec succès avant de s'arrêter ».

**Fait.**

1. **T-232 — dates civiles.** Un helper unique (`src/lib/dates.ts`) distingue date civile (jamais
   décalée) et instant (fuseau explicite). `pg` renvoie désormais les colonnes `date` en chaînes
   (`setTypeParser(1082)`), ce qui supprime la dérive d'un jour constatée avec `TZ=Africa/Douala`.
   Les 7 derniers `toLocaleDateString` (pages légales, analytics, calendrier, gestionnaires en
   masse) passent par ce helper : **0 occurrence restante** dans `src/`.
2. **T-233 — cascade de suspension.** `src/lib/host-suspension.ts` bascule les annonces
   `active ↔ suspended` en transaction, de façon idempotente, depuis la suspension unitaire et le
   bulk ; recherche, fiche et tunnel filtrent sur un hôte actif. L'anomalie « la fiche reste en
   200 » venait de **deux instances du module de cache** (bundles page et route distincts) :
   le cache est ancré sur `globalThis`, et la fiche porte en plus une garde de visibilité hors cache.
3. **T-234 — expiration paresseuse.** La purge d'expiration est extraite du cron vers une lib
   partagée et s'exécute **dans la transaction** du tunnel et du devis, bornée à la chambre et à la
   fenêtre demandées ; les notifications partent après le commit. La lecture de stock
   (`loadBookedCounts`) cesse de compter une demande expirée non encore balayée.

**Preuves.** `npm run ci` verte de bout en bout (vitest **709 tests / 120 fichiers**, smoke
**95/95**) ; runtime réel : fiche `200 → 404 → 404 → 200`, total d'annonces `8 → 0 → 8`, réservation
`400` puis `201` ; demande expirée : `201` au lieu de `409` (le `409` du constat F3 est reproduit en
retirant le correctif), disponibilité `0/1 → 1/0`.

**Base.** Restaurée à l'identique du seed (8 users / 8 annonces `active` / 34 réservations / 25 avis),
aucun résidu de sonde.

**Suites.** T-235 → T-239 et T-241 restent au BACKLOG (quota avant validation, heure d'arrivée,
validation d'annonce notifiée, wishlist partagée, désabonnement, finitions d'admin).

## 2026-09-11 — T-235 → T-239 : cinq finitions d'audit (F4 → F8)

**T-235 (F4) — le quota de réservation ne punit plus les erreurs de saisie.** Deux compteurs aux
rôles distincts : un garde-fou anti-abus **60/h** posé **avant** la lecture du corps, et le quota
produit **10/h** consommé **après** validation du payload. La clé invité devient un cookie signé
`mbb_guest` (repli IP) : deux voyageurs derrière la même IP publique ne se pénalisent plus. Le
refus porte `Retry-After` et un délai lisible, traduit en anglais.

**T-236 (F5) — l'heure d'arrivée estimée est enfin restituée.** Validation `HH:MM` à l'entrée
(l'API ne peut plus casser la colonne `time`) et affichage sur la fiche hôte, dans l'espace
voyageur et dans les **4 e-mails** de demande/confirmation (FR/EN).

**T-237 (F6) — la décision d'annonce est expliquée.** Colonne additive
`properties.review_reason` (migration **0022**) : motif persisté au rejet/suspension, **effacé à
l'approbation**, affiché à l'hôte ; notification idempotente via l'outbox avec interrupteurs admin
dédiés et gabarits FR/EN. Un rejeu ne produit jamais de second e-mail.

**T-238 (F7) — la wishlist partagée cesse d'être indexable.** `noindex`/`nofollow`, notice de
partage et infobulle de rotation ; la rotation existante est désormais **prouvée** par un test
(ancien lien 404 / nouveau 200).

**T-239 (F8) — le désabonnement promis existe.** Jeton **HMAC-SHA256** sur `userId|catégorie`
(vérification à temps constant, catégorie whitelistée), page publique `/desabonnement` idempotente
et `noindex`, pied d'opposition sur les alertes prix — seul envoi non transactionnel. La page
Confidentialité FR/EN dit maintenant exactement ce qui est refusable et ce qui reste dû.

**Preuves.** `npm run ci` verte : typecheck 0 · lint 0/0 · i18n 0 candidat · **vitest 127 fichiers
/ 735 tests** · build · **smoke 95/95** · `ai:check` 19 OK / 1 warn (R7). Runtime : 10 essais
invalides → **400 ×10** puis demande valide → **201** ; fiche hôte affichant « Heure d'arrivée
estimée : 15:30 » ; `/desabonnement` → 200 `noindex` et `price_alert_enabled` basculé à `false`.

**Base.** Restaurée à l'identique du seed (31 réservations, 0 compte de sonde, outbox nettoyée).

**Suites.** T-241 (finitions admin/analytics/erreurs d'API) puis resynchronisation de `STATE.md`
en fin de session.

## 2026-09-11 — T-241 : finitions d'audit (F11 + F12 + F13)

**F11 — « supprimé » vs « suspendu ».** Déjà livré par T-230 : `suspended_at` et `deleted_at` sont
deux colonnes distinctes, l'UI remplace **Réactiver** par « Compte anonymisé — non réactivable ».
Vérifié en base et dans les deux catalogues de libellés ; aucun code ajouté.

**F12 — analytics : période choisie et export.** `src/lib/analytics-period.ts` (pur, dates civiles,
arithmétique UTC) accepte `?from&to` et rend **exactement** la fenêtre historique quand rien n'est
passé (30 jours, comparaison de même longueur) ; étendue bornée à 366 jours, fin future ramenée à
aujourd'hui. Les agrégats quittent la page pour `src/lib/analytics.ts` afin que l'écran et l'export
CSV affichent les mêmes nombres. La page gagne deux champs de date, un bouton Appliquer et un export
`GET /api/dashboard/analytics/export` (sections Résumé / Revenus par jour / Top hébergements,
en-têtes localisés, devises jamais additionnées, protection anti-formule).

**F13 — erreurs d'API lisibles, champs inconnus refusés.** `zodIssues`/`zodErrorResponse` renvoient
400 avec `{ error, issues: [{ field, message }] }` — libellés traduits (aucune fuite d'anglais Zod,
contrat T-159 conservé sous une nouvelle forme), champs inconnus éclatés un par un. Vingt routes
adoptent le helper ; les schémas de mutation réellement utilisés par l'UI passent en `.strict()` :
`PUT /api/bookings/[id]` avec `{ "paymentStatus": "paid" }` répond désormais 400 en nommant le champ
au lieu d'un 200 silencieux.

**Preuves.** `npm run ci` verte : typecheck 0 · lint 0 · i18n 0 candidat · **vitest 129 fichiers /
743 tests** · build · **smoke 95/95** · `ai:check` 19 OK / 1 warn (R7). Runtime : export CSV 200
(défaut et période explicite), 400 sur période inversée, 403 sans session ; page analytique 200 avec
et sans paramètre.

## T-245 → T-250 — exécution de l'audit n°5 (2026-09-11)

**Une fenêtre, pas un paginateur.** Les six écrans de liste (`dashboard/bookings`, `users`,
`reviews`, `properties`, `promotions`, `mes-reservations`) filtrent, trient et comptent **côté
client** : un `?page=N` aurait rendu les filtres partiels et les compteurs faux. `parsePageWindow`
borne donc le **chargement** (25 lignes, +25, plafond 500) et `<ShowMore>` dit ce que l'écran
montre : « N résultats affichés sur M », « Afficher 25 de plus », « Tout afficher », avec un
avertissement au plafond et un rappel que les filtres portent sur les lignes affichées. Les liens
conservent `?status=` / `?payment=` et retirent `limit` au retour par défaut. Côté API, la
pagination est **opt-in** (`parseApiPagination`) : sans paramètre la réponse historique est
inchangée au caractère près, avec `limit`/`offset` elle est bornée et `X-Total-Count` porte le
total ; `limit=0`, `limit=-3`, `limit=abc`, `limit=1.5`, `offset=-1` répondent 400.

**Le motif se saisit, il ne se devine pas.** `Dialog` reproduit ce qu'un `window.prompt` ne fait
pas : rôle, `aria-modal`, piège de focus Tab/Maj+Tab, Esc, verrouillage du scroll, retour du focus à
l'élément déclencheur ; `ReasonDialog` impose un motif non vide (compteur 0/500) et le serveur
refuse désormais `hidden`/`rejected` sans motif (400 nommant `moderationReason`), tout en conservant
`approved`/`pending` inchangés.

**Un favori va là où l'utilisateur le dit.** `GET /api/wishlists` trie (ordre stable) et expose
`defaultWishlistId` — le cœur n'écrit plus dans un `wishlists[0]` implicite ; `PATCH` accepte `name`
(1-80, `trim`) sans toucher au `shareToken` ; `POST /api/wishlists/move` insère la cible **puis**
supprime la source dans la même transaction (404 si la liste appartient à un tiers, si le favori
n'est pas dans la source, 400 si les listes sont identiques ou le bien déjà présent).

**Le cron laisse une trace.** `runWithTrace` écrit une ligne `cron_runs` en fin d'exécution **et**
dans le `catch` (jamais au prix de la tâche métier : l'échec d'insertion est journalisé et ignoré),
`getCronHealth` classe chaque tâche (`ok` / `stale` au-delà de 3 périodes / `failed` / `missing`) et
`/api/health` l'expose **sans changer son contrat** (`ok` reste `true` tant que la base répond).
L'écran `/dashboard/cron` montre l'état, les compteurs et l'historique ; la purge de 90 jours
rejoint `purgeTechnicalData()`.

**Un solde s'explique.** `wallet_transactions` est append-only (`amount` **signé** en EUR,
`balance_after`, `kind`, `booking_id`, `actor_id`, `note`) et chaque écriture de
`users.wallet_balance` écrit sa ligne **dans la même transaction** : un échec du journal annule le
crédit (prouvé par test). `users.wallet_balance` reste la source de vérité — aucun écran ne change de
logique — et `/mon-compte` gagne un historique en lecture seule (`GET /api/wallet/transactions`).
**Le solde est gelé — et on le dit.** Décision produit du 2026-09-11 : le wallet BestRewards reste un
**crédit futur**. Aucun code de déduction n'est ajouté ; les libellés qui parlent du solde annoncent le
gel (`account.availableBalance` « Crédit accumulé (crédit futur) », `account.walletHint`,
`search.walletBanner`, `reservation.walletReductionNote`, `bestrewards.benefitCashback`,
`bestrewards.how3Desc`, `bestrewards.faq4A`, FR et EN — 14 valeurs révisées, aucune clé ajoutée, verrou
inchangé à 1739) et `src/lib/wallet-policy.test.ts` verrouille la décision : il échoue si les libellés
cessent d'annoncer le gel ou si `applyWalletToTotal` / une déduction réapparaît. La décision est
inscrite dans `KNOWN_LIMITATIONS.md` : ouvrir la consommation (avoir au règlement sur place avec une
ligne `kind: "booking_payment"`) devient un choix produit explicite, pas une évolution silencieuse.

**Preuves.** `npm run ci` verte : typecheck 0 · lint 0 · vitest **135 fichiers / 775 tests** ·
build · smoke **95/95** · `ai:check` 19 OK / 1 warn (R7). Runtime : fenêtre et plafond des listes,
pagination API et ses bornes, `/api/health` avant/après exécution du cron, écran `/dashboard/cron`,
`/api/wallet/transactions` (200 / 401 / 400). Base rendue à l'état seed après les sondes.

## 2026-09-11 — Audit runtime n°6 : les finitions qui trompent

Sixième passe d'exécution, demandée après le gel du wallet. Le parti pris est inverse de la
précédente : ne chercher ni panne ni fonctionnalité absente, mais **ce qui existe, s'affiche et
ment** — une valeur de supervision calculée sur la mauvaise cadence, un lien d'e-mail qui ne
fonctionne que si la variable d'environnement est là, une liste qui s'arrête sans le dire.

**Ce qui a été parcouru.** 45 pages balayées avec les trois rôles (0 erreur applicative), 71 routes
API, 90 appels d'interface confrontés aux routes, confrontation systématique
**schéma ↔ API ↔ formulaires** (colonnes que personne ne peut remplir), `email_outbox` relue
(73 lignes), trace `cron_runs` datée de −4 h insérée puis supprimée pour mesurer l'état affiché par
`/api/health`, test runtime des paramètres que l'interface n'expose pas (`sort=popularity`,
`minRating`, `near`, `search`).

**Les 12 constats.** B1 la cadence déclarée du cron (1 h) contredit `vercel.json` (quotidien 08:00)
→ « En retard » ~21 h sur 24 ; B2 `/api/cron/payouts` planifié, muet et en 410 quotidien ; B3 trois
stratégies de base URL dans les e-mails (liens relatifs avec `?? ""`, liens localhost avec
`?? "http://localhost:3000"`) alors que `appBaseUrl()` existe ; B4 deux écrans de liste sans fenêtre
et un N+1 par bien ; B5 les avis de la fiche plafonnés à 5 sans compteur ni page dédiée, alors que
l'API est paginée ; B6 `description_en`, `state`, coordonnées : affichés, jamais éditables ; B7
quatre capacités d'API sans entrée d'interface ; B8 le crédit gelé disparaît sans mot à la
suppression de compte ; B9 une seule préférence de notification par utilisateur contre onze réglages
globaux ; B10 dettes T-207 à récapituler ; B11 dix écrans lourds sans `loading.tsx` ; B12
rate-limit en mémoire à rappeler au déploiement.

**Ce qui est infirmé.** Aucun bouton mort (1 seul `<button>` sans handler, volontairement
désactivé), aucun texte en dur, aucune route sans contrôle justifié, aucun interrupteur d'e-mail
dormant (12/12 lus), le cron n'annule toujours pas les demandes manuelles (T-203), le contrat bulk
porte bien ses motifs, l'interface n'atteint jamais les 410 du paiement en ligne.

**Livrable.** `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` — **aucune ligne de
code modifiée**, base rendue à l'état seed. Solutions découpées en lots A→D, à trancher en oui/non.

## Audit n°6 — exécution (lot A puis lot B) — 2026-09-11

**Lot A (commit `11165d4`) — rendre la supervision et les liens vrais.** Le seuil « stale » de
`getCronHealth` suit désormais la cadence réellement déclarée (`CRON_SCHEDULES` : 3 × 24 h pour
`price-alerts`, au lieu d'un 4 h hérité d'une cadence fantôme), `/api/cron/payouts` est retiré de
`vercel.json` (410 quotidien tant que `platformPayoutsEnabled()` est faux ; exécution manuelle par
`scripts/cron-runner.mjs`), les e-mails passent par `appBaseUrl()` dans 10 fichiers (seul
`verify/route.ts` garde la sienne, justifié) et un squelette `loading.tsx` n'est posé que sur une
feuille (`(main)/mon-compte`) — jamais au-dessus d'une route `[id]` (BUG-051 : soft-404 figé à 200).

**Lot B (T-257) — les deux derniers écrans hors fenêtre, et le N+1 de l'hôte.** `/dashboard/messages`
et `/dashboard/rooms` chargeaient l'intégralité des lignes alors que sept écrans appliquaient déjà la
fenêtre T-245 ; la branche hôte de `rooms` interrogeait en plus la base **une fois par bien**. La
branche hôte passe par la même jointure `rooms ⋈ properties` que l'admin (filtre `host_id`), avec
`countRooms()` pour la fenêtre ; `conversationScope()` est extrait pour que la liste et le compteur de
conversations partagent exactement le même périmètre (participant + fenêtre de rattrapage du
brouillon). Les deux écrans adoptent `parsePageWindow` + `<ShowMore>` : mêmes bornes, mêmes libellés,
aucun `?page=` introduit (filtres et compteurs restent client).

**Lot B (T-258) — un bien à 40 avis n'en montre plus 5 pour toujours.** La fiche garde sa fenêtre de
5 avis (même requête, même cache TTL 60 s) mais l'en-tête affiche le total (« Avis vérifiés ✓ —
24 avis ») et un bouton « Voir les 24 avis » n'apparaît que s'il y a plus de lignes que la fenêtre.
La page dédiée `/hebergement/[slug]/avis` réutilise les mêmes règles de visibilité
(`getPropertyForReviews` : bien actif + hôte actif, exception pour l'hôte propriétaire et l'admin),
pagine 20 avis par page avec `?page=` et `generateMetadata`, et partage le rendu via
`PropertyReviewsList` (aucun changement visuel : réponse d'hôte, 👍/👎, pays, type de voyageur, bouton
« Utile »). Le titre réutilise `property.reviews`, orpheline jusqu'ici. Verrou i18n **1739 → 1742**
(+3 clés FR/EN).

**Preuves.** `list-window.t257.test.ts` **3/3** (23 chambres → aucun bandeau ; 26 lignes → « 25
résultats affichés sur 26 » ; messages 26 fils idem) et `reviews-page.t258.test.ts` **3/3** (bien porté
à 24 avis : compteur + lien + fiche toujours bornée à 5 ; page 1 = 20 lignes avec `?page=2`, page 2 =
fin de liste ; slug inconnu → `notFound()`), fixtures purgées et agrégats recalculés en `afterAll`.
`npm run ci` **verte** (typecheck 0 · lint 0/0 · `ai:check` 20 OK / 0 warn / 0 fail · vitest 138
fichiers / 761 tests passés (789 collectés, 28 ignorés) · build 67 pages · smoke 95/95). Rapports :
`REPORTS/validation_T257_T258_2026-09-11_audit6_B4_B5.md` + analyses d'impact et de conception
T-257/T-258 (exigées par R12 pour une tâche de niveau S).

## T-259 — audit n°6, B6 : description EN, région et coordonnées (2026-09-11)

**Trois colonnes, deux affichages publics, zéro saisie.** `description_en` était lue par
`LocalizedDescription` (repli FR systématique, 0/8 renseignée), `state` composait l'adresse publique
(0/8) et `latitude`/`longitude` alimentaient `?near=` (8/8 — **par le seed uniquement**, donc toute
annonce créée par un hôte était ignorée de « autour de moi »). Les schémas d'API acceptaient en plus
n'importe quelle chaîne pour les coordonnées, et `state` sans borne alors que la colonne est un
`varchar(100)` (saisie trop longue → 500).

**Un helper, deux schémas, deux formulaires.** `src/lib/coordinates.ts` porte les bornes
(−90..90 / −180..180), la tolérance à la virgule décimale (« 43,769 » → « 43.769 »), la conversion
`""` ⇒ `null` (effacer une coordonnée plutôt qu'écrire une chaîne vide dans un `decimal`) et
`displayCoordinate()` (PostgreSQL rend « 43.76900000 » — le champ ne montre plus une précision que
l'utilisateur n'a jamais saisie). Le POST de création et le PUT d'édition partagent les mêmes règles ;
le PUT restant **partiel** (`...data`), aucune écriture existante ne change. L'éditeur envoie
désormais les quatre colonnes et la page `[id]` les transmet — sans cette transmission,
l'enregistrement les aurait **effacées** (piège couvert par un test de restitution). Aucune migration :
les colonnes existaient depuis l'origine.

**Preuves.** `route.t259` **4/4** (persistance avec virgule, refus hors bornes et région > 100 sans
écriture, effacement puis relecture via `toPublicProperty`, région acceptée à la création),
`coordinates` **3/3**, `ui-strings` 7/7 (verrou **1742 → 1748**), vitest complet **142 fichiers /
796 tests, 0 échec**, tsc 0, eslint 0/0. Sonde runtime sur un bien du seed : libellés rendus, PUT
« 43,769 » → base `43.76900000`, relecture « 43.769 », puis valeurs du seed restaurées.
Rapports : `REPORTS/validation_T259_2026-09-11_audit6_B6.md` (+ analyses d'impact et de conception).

## T-262 — audit n°6, B8 : le crédit gelé ne disparaît plus en silence (2026-09-11)

**Le seul scénario où le gel T-248 §3 se retourne contre l'utilisateur.** `DELETE /api/users/me`
anonymisait l'identité (T-242) sans toucher `users.wallet_balance` : un solde accumulé
(BestRewards, parrainage, remboursements) restait attaché à une ligne
`deleted-…@anonymized.local` — ni consultable (session révoquée), ni utilisable (gel), ni
remboursé, et **sans une ligne de journal**. Ni l'utilisateur ni le support ne pouvaient savoir ce
qui s'était passé.

**Deux gestes, aucun centime déplacé.** (1) La zone de danger affiche avant l'action un encart
conditionnel « Votre crédit accumulé de X sera perdu : il s'agit d'un crédit futur, non utilisé et
non remboursable » (montant dans la devise d'affichage, mêmes helpers que la carte wallet).
(2) La transaction de suppression écrit une ligne `wallet_transactions` `account_closed`
(`amount = "0.00"`, `balanceAfter` = solde) : le journal est append-only, le solde **n'est pas
modifié**. `recordWalletEntry()` continue d'ignorer les mouvements nuls ; la clôture a son écrivain
dédié `recordAccountClosureEntry()`. Écrire dans la transaction garantit qu'il n'existe ni
suppression sans trace, ni trace orpheline. Aucune migration : `kind` est un `varchar(32)`. Le refus
de suppression tant que le solde est > 0 a été examiné puis écarté (il bloquerait un droit RGPD).

**Preuves.** `route.t262` **2/2** (compte à 12,50 → une ligne `0.00`/`12.50`, solde intact et
anonymisation T-242 intacte ; compte à 0 → aucune ligne), `delete-account-section` **2/2**
(encart rendu avec le montant, absent à 0), `wallet-ledger` 5/5, `wallet-policy` 3/3 (garde-fou du
gel étendu à la suppression), `ui-strings` 7/7 (verrou **1748 → 1749**), tsc 0, eslint 0/0. Sonde
runtime : client jetable à 12,50 supprimé → base `deleted-…@anonymized.local`, solde `12.50`
inchangé, journal `account_closed` `0.00`/`12.50`, puis ménage (base revenue à l'état seed).
Rapports : `REPORTS/validation_T262_2026-09-11_audit6_B8.md` (+ impact et conception).

**Fragilité découverte au passage (test T-258).** Le test `reviews-page.t258.test.ts` supposait
« 2 avis déjà présents sur B&B Toscana » et plaçait ses 22 avis d'essai **plus récents** que ceux du
seed : faux dès qu'un seed fraîchement régénéré donne 3 avis au bien ou des avis de moins de
20 minutes. Le socle du test calcule désormais le total attendu (`count()` sur les avis approuvés)
et ancre ses avis une seconde d'écart **au-dessus** du plus récent avis existant — la suite est
insensible au tirage aléatoire du seed (`Math.random()` dans `api/seed`).

