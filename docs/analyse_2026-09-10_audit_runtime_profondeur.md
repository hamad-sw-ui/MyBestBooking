# Analyse n°4 — audit runtime de profondeur (cloisonnement, cycle de vie, stock, dates)

> **Date** : 2026-09-10 · **Périmètre** : application en exécution (dev `:3000` + PostgreSQL `:55432`),
> 53 routes API, 5 identités (anonyme, voyageur, hôte, second hôte créé pour la sonde, admin).
> **Nature** : analyse seule — aucune ligne de code produit modifiée par cette passe.
> **Rapport d'origine** : `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (copie `.ai/REPORTS/`).
> **Suites** : `T-242` → `T-244` (nouveaux) dans `.ai/BACKLOG.md` ; confirmations rattachées à `T-232` → `T-241`.

---

## 1. Objet et méthode

Les analyses n°1 à n°3 ont couvert les fonctionnalités inachevées (T-221→T-231) puis les scénarios
runtime (T-232→T-241). Cette quatrième passe ne rejoue pas les mêmes sondes : elle **attaque des
surfaces jamais interrogées** (cloisonnement multi-tenant, cycle de vie des données personnelles,
rétention technique, stock affiché vs stock vendable, matrice de permissions) et **chiffre** les
constats antérieurs qui n'avaient pas encore de preuve runtime.

Moyens mis en œuvre :

| Moyen | Détail |
| --- | --- |
| Sonde de cloisonnement | `probe4.tmp.mjs` (supprimée après usage) : création d'un **second hôte** (`approval_status='approved'`), d'une annonce `draft`, d'une chambre, d'une conversation + message, de deux wishlists (privée/partagée), puis **24 cas × 5 identités** = 120 requêtes HTTP, avec restauration immédiate de toute écriture acceptée à tort. |
| Sondes d'intégrité | vérification en base après chaque cas (`users`, `properties`, `bookings`, `reviews`, `conversations`, `wishlists`, `email_outbox`, `audit_log`). |
| Analyse statique croisée | recherche automatisée « route API sans appelant » et « appel vers un chemin inexistant » sur tout `src/`, lecture des transactions (booking, annulation, modération, anonymisation). |
| Non-régression de l'environnement | après sondes : base remise à l'état du seed — **8 users / 8 properties / 33 bookings / 24 reviews**, 0 conversation, 0 wishlist, 0 e-mail outbox, 0 entrée d'audit résiduelle. |

---

## 2. Synthèse

| # | Constat | Gravité | Effort | Statut |
| --- | --- | --- | --- | --- |
| N1 | Suppression de compte : anonymisation **partielle** (`users` seulement), les copies de l'identité subsistent ailleurs | 🔴 haute | S/M | **nouveau** (T-242) |
| N2 | **Aucune purge** des données techniques (`sessions` expirées, `email_outbox` livrés, `audit_log`) | 🟠 moyenne | XS/S | **nouveau** (T-243) |
| N3 | Calendrier hôte : le stock affiché n'est **pas décrémenté** des séjours, donc faux | 🟠 moyenne | S/M | **nouveau** (T-244), précise O2 |
| C1 | Dates de séjour et fuseaux (F1/F10) | 🔴 haute | M | confirmé → T-232 |
| C2 | Suspension d'hôte sans effet sur le catalogue (F2) | 🔴 haute | M | confirmé → T-233 |
| C3 | Demande en attente verrouillante jusqu'au cron (F3) | 🟠 moyenne | S/M | confirmé → T-234 |
| C4 | Quota de réservation compté avant validation (F4) | 🟠 moyenne | S | confirmé → T-235 |
| C5 | Heure d'arrivée estimée jamais restituée (F5) | 🟠 moyenne | XS | confirmé → T-236 |
| C6 | Fuseau horaire : réglage décoratif + liste fermée incohérente avec l'API (F9) | 🟠 moyenne | S | confirmé → T-227 |
| C7 | Analytics figé 30 jours, sans export (F12) | 🟡 basse | S | confirmé → T-241 (b) |

**Ce qui est sain** (et qui n'a pas besoin d'être touché) : voir § 4 — matrice de permissions
complète, révocation de session sur suspension/suppression, restauration des bénéfices
(promo/wallet) à l'annulation, idempotence des e-mails, anti-double vote « avis utile », endpoints
sensibles fermés (exports, admin, seed en production), brouillons et wishlist privée non exposés.

---

## 3. Nouveaux constats (détail)

### N1 🔴 — Suppression de compte : l'anonymisation ne couvre que la table `users`

**Problème.** `DELETE /api/users/me` anonymise `users` (e-mail haché
`deleted-<sha256[:16]>@anonymized.local`, `firstName/lastName/phone/avatar` effacés, 2FA purgée,
sessions supprimées) — `src/app/api/users/me/route.ts:154-183`. Mais l'identité du demandeur est
**recopiée dans d'autres tables** qui ne sont jamais nettoyées :

| Table | Donnée conservée | Origine |
| --- | --- | --- |
| `bookings` | `guest_email`, `guest_first_name`, `guest_last_name` (copie de l'identité au moment de la réservation) | `src/db/schema.ts` (bookings) |
| `email_outbox` | `to` = adresse e-mail d'origine de **chaque** e-mail envoyé | `src/lib/email-outbox.ts` |
| `audit_log` | `metadata.targetEmail` = adresse d'origine (ex. trace de suspension) | `src/app/api/users/[id]/suspend/route.ts:67` |
| `messages` | contenu libre (nom, téléphone, adresse postale fréquemment cités) | `src/db/schema.ts` (messages) |

**Preuve.** Sonde d'anonymisation : après `DELETE /api/users/me`, l'utilisateur est bien anonymisé
et sa session révoquée (401 immédiat) — mais la ligne `audit_log` créée par la sonde de suspension
contenait encore `{"targetEmail":"customer@mybestbooking.com"}`, et la table `email_outbox` garde
`to` en clair (3 lignes observées pendant la campagne, dont l'adresse réelle du destinataire).
Le code d'anonymisation ne touche ni `bookings.guest_*`, ni `email_outbox`, ni `audit_log`.

**Impact.** La page Confidentialité promet une « anonymisation en base pour conserver factures et
avis comme la loi l'exige » (`src/app/(main)/confidentialite/page.tsx:76`) : c'est exact pour la
**conservation commerciale** (montants, dates, références) mais pas pour les **identifiants
personnels** (adresse e-mail, nom), qui ne sont pas nécessaires à la comptabilité. Un utilisateur
qui exerce son droit à l'effacement conserve donc son adresse dans trois tables.

**Correctif non régressif (proposé).** Dans la même transaction que l'anonymisation actuelle,
ajouter trois `UPDATE` ciblés qui **préservent les agrégats** :

1. `bookings` de l'utilisateur : `guest_email = anonymizedEmail`, `guest_first_name = 'Supprimé'`,
   `guest_last_name = 'Compte'` (référence, dates, montants, commission inchangés → factures
   toujours conformes) ;
2. `email_outbox` : `to = anonymizedEmail` pour toutes les lignes dont `to` = ancienne adresse
   (l'historique d'envoi reste, l'adresse disparaît) ;
3. `audit_log` : redaction de `metadata->>'targetEmail'` pour les entrées visant cet utilisateur
   (l'action et sa date restent, seule l'adresse est masquée).

Tests : test d'intégration « après DELETE, aucune occurrence de l'adresse d'origine dans
`users`, `bookings`, `email_outbox`, `audit_log`, `sessions` » + test inverse « la facture d'un
séjour antérieur reste générable (404/200 explicite, jamais 500) ».

---

### N2 🟠 — Aucune purge des données techniques : sessions, outbox, journal d'audit

**Problème.** Le cron quotidien (`/api/cron/price-alerts`, `vercel.json` 08:00 UTC) nettoie les
uploads orphelins mais rien d'autre. `sessions` n'est purgé que par effet de bord (déconnexion,
changement/ réinitialisation de mot de passe, suspension) ; `email_outbox` conserve
indéfiniment les messages `sent`/`failed` ; `audit_log` n'a aucune politique de rétention.

**Preuve.** `grep` exhaustif des suppressions : six `delete(sessions)` (tous événementiels),
aucun `delete(emailOutbox)`, aucun `delete(auditLog)`, aucune mention de rétention dans le cron.
Base laissée après campagne : `sessions = 27` alors que le seed n'en crée aucune (les sessions
expirées restent en base avec `expires_at` dépassé, `getSession()` les rejette sans les supprimer).

**Impact.** Croissance monotone (une ligne de session par connexion « remember me » de 30 jours,
une ligne outbox par e-mail, une ligne d'audit par action admin) ; en production, la table
`sessions` devient la plus volumineuse et le `SELECT ... WHERE token = $1` s'alourdit.
Effet secondaire : un e-mail `failed` reste invisible (aucune vue admin — cf. O3) sans aucun
mécanisme d'alerte.

**Correctif non régressif.** Étendre le cron existant d'une fonction `purgeTechnicalData()` :

- `DELETE FROM sessions WHERE expires_at < now() - interval '7 days'` (garde une fenêtre pour
  l'analyse d'incident) ;
- `DELETE FROM email_outbox WHERE created_at < now() - interval '90 days'` (les `pending` ne sont
  **jamais** touchés, quel que soit leur âge) ;
- journal d'audit : conservation configurable (min. 1 an) — à défaut de purge, documenter la
  rétention dans `.ai/DATABASE.md` et exposer les compteurs dans le cron pour l'observabilité.
- Compteurs renvoyés par le cron (`sessionsPurged`, `emailsPurged`) → testable, observable, sans
  changement d'API pour le client.

---

### N3 🟠 — Calendrier hôte : le stock affiché n'est jamais décrémenté des séjours

**Problème.** `GET /api/rooms/[id]/availability` renvoie **uniquement** les lignes
`room_availability` (stock déclaré par l'hôte), sans croiser les réservations actives
(`src/app/api/rooms/[id]/availability/route.ts`, handler GET). Le tunnel de réservation, lui,
applique bien les deux (`capacity = min(availableCount, quantity)` **moins** les chevauchements) —
`src/app/api/bookings/route.ts:205-232`. Les deux vues divergent donc : le calendrier peut
afficher « 2 disponibles » un jour où il ne reste qu'une unité.

**Preuve (données du seed, chambre « Chambre Standard », capacité 2).**

```
jour        stock_affiché  capacité  séjours_en_cours
2026-09-23        2           2            0
2026-09-24        2           2            1
2026-09-25        2           2            1
2026-09-26        2           2            1
```

La sonde de chevauchement confirme que la 2ᵉ demande sur ces dates est refusée en 409 : la
plateforme **ne peut pas** vendre 2 unités, mais le calendrier l'affiche.

**Impact.** L'hôte gère son stock sur une information fausse (survente ressentie comme un bug,
ou blocage inutile de dates par prudence) ; le support n'a pas de vue « reste réel ». C'est aussi
la cause racine de O2 (le calendrier n'affiche pas les séjours) — mais l'enjeu n'est pas
cosmétique : **le chiffre est faux**.

**Correctif non régressif.** Étendre la réponse GET (champ **additif** `bookedCount`, l'`availableCount`
déclaré reste inchangé pour ne rien casser) et afficher dans `AvailabilityCalendar`
« reste X / déclaré Y ». Implémentation : même requête que le tunnel (agrégat des chevauchements
sur la plage, hors `cancelled`), aucun changement de schéma ni de contrat existant.

---

## 4. Confirmations runtime (constats déjà planifiés, preuves ajoutées)

### C1 🔴 — Dates de séjour et fuseaux (T-232)

- Colonnes `date` (sans heure) ; `pg` les rend en `Date` à **minuit du fuseau serveur** :
  `TZ=Africa/Douala` → `2026-09-23T23:00:00.000Z` pour un séjour du 24. `formatDate()`
  (`src/lib/utils.ts:28-40`) applique ensuite le fuseau **du lecteur** : à `America/Los_Angeles`,
  le 24 s'affiche « 23 septembre » ; le HTML rendu par le serveur (UTC+X) et le rendu client
  peuvent diverger → risque d'hydratation et, surtout, **date de séjour fausse** à l'écran.
- `toDate()` (`src/lib/booking-lifecycle.ts:12-14`) convertit une `Date` via `toISOString()` :
  sur un serveur en UTC+X, la clôture d'un séjour peut être acceptée **la veille**
  (`transitionError('completed')` compare la date du départ au jour courant), et
  `isReviewEligible` hérite du même décalage. Le cron, lui, raisonne en UTC.
- À l'inverse, les e-mails (qui forcent le fuseau) sont justes : la divergence n'apparaît que
  dans l'interface web — donc au moment où l'utilisateur agit.

### C2 🔴 — Suspension d'hôte sans effet sur le catalogue (T-233)

Prouvé deux fois : après `PATCH /api/users/[id]/suspend` (session du compte suspendu immédiatement
révoquée : `GET /api/auth/me` → 401), la fiche publique reste **200** et l'annonce continue
d'apparaître dans `/recherche`. **Complément nouveau** : les demandes `pending` en cours chez cet
hôte ne sont ni annulées ni signalées — elles restent vivantes jusqu'à l'expiration (24 h) et
bloquent les dates (cf. C3) alors que l'hôte ne peut plus répondre. Le correctif doit donc
inclure le sort des demandes en attente (annulation + e-mail voyageur), pas seulement le statut
des annonces.

### C3 🟠 — Demande en attente verrouillante (T-234)

Une demande `pending` compte comme occupante (`ne(status,'cancelled')` dans la requête de
chevauchement) : la 2ᵉ tentative sur les mêmes dates répond **409 « Cette chambre n'est plus
disponible pour ces dates »** alors que la 1ʳᵉ n'est qu'une demande sans engagement. La libération
dépend du cron quotidien (08:00 UTC) ; en l'absence de cron (auto-hébergement, panne), la
libération n'a jamais lieu. Recommandation inchangée : **expiration paresseuse** dans la
transaction de création (fonction partagée extraite de `expireManualBookingRequests`).

### C4 🟠 — Quota de réservation compté avant validation (T-235)

Le rate-limit (`POST /api/bookings`, 10/heure) est incrémenté **avant** les contrôles. Reproduit
trois fois : après une série d'essais refusés (dates inversées, capacité dépassée, promotion
inconnue), une demande **valide** répond **429** pendant jusqu'à une heure, sans que l'interface
n'affiche le délai d'attente. Les invités partagent en outre la clé IP (NAT familial/entreprise).

### C5 🟠 — Heure d'arrivée estimée jamais restituée (T-236)

`bookings.estimated_arrival` est collecté par le formulaire de réservation mais **lu nulle part**
(fiche hôte, e-mails de demande/confirmation). Précision supplémentaire : l'API accepte une
chaîne libre (`z.string().optional()`) alors que la colonne est de type `time` — un appel direct
avec une valeur hors format produit une erreur PostgreSQL (500) là où l'interface, elle, ne
propose que des heures pleines.

### C6 🟠 — Fuseau horaire : décoratif et incohérent (T-227)

`users.timezone` est proposé par `ProfileForm` dans une liste **fermée de 10 valeurs** alors que
`PATCH /api/users/me` accepte n'importe quelle chaîne de ≤ 50 caractères (`Pas/Un-Fuseau` → 200,
vérifié). Aucun module ne lit la valeur (ni affichage, ni crons, ni e-mails). Idem
`properties.timezone`, jamais exposé par les API d'annonce. Recommandation : valider côté serveur
(liste IANA réelle) **et** soit consommer la valeur, soit retirer l'illusion de réglage.

### C7 🟡 — Analytics figé (T-241 b)

`/dashboard/analytics` calcule une fenêtre de 30 jours en dur, sans paramètre de période ni export
CSV, alors que la page affiche des évolutions « vs 30 jours précédents » non auditables par
l'hôte.

---

## 5. Ce qui est sain (preuves positives)

**Matrice de permissions** (24 cas × 5 identités ; `anon` = sans cookie). Extrait vérifié :

| Route | anon | voyageur | hôte | hôte tiers | admin |
| --- | --- | --- | --- | --- | --- |
| `GET /api/bookings/<résa du voyageur>` | 401 | **200** | 200 | 403 | 200 |
| `GET /api/bookings/<résa d'un autre>` | 401 | **403** | 200 | 403 | 200 |
| `GET …/invoice` (résa d'un autre) | 401 | **403** | 200 | 403 | 200 |
| `POST /api/messages` (fil d'un tiers) | 401 | 201 (participant) | **403** | 201 (participant) | 201 |
| `GET /api/properties/<brouillon d'un autre>` | 404 | 404 | **404** | 200 (propriétaire) | 200 |
| `PUT /api/rooms/<chambre d'un autre>` | 401 | 403 | 200 | **403** | 200 |
| `PATCH /api/users/<id>/suspend` | 403 | 403 | **403** | 403 | 200 |
| `GET /api/admin/{audit,settings}` | 403 | **403** | **403** | 403 | 200 |
| `GET /api/dashboard/billing/export[-payouts]` | 403 | **403** | 200 | 200 | 200 |
| `GET /api/wishlists/shared/<jeton privé>` | **404** | 404 | 404 | 404 | 404 |

Autres points vérifiés sans anomalie :

- **Révocation de session effective** : suspension, suppression, changement et réinitialisation de
  mot de passe suppriment les sessions ; un cookie antérieur est rejeté (401) — pas de « token
  zombie ».
- **Bénéfices rendus à l'annulation** : `releaseBookingBenefits()` décrémente la promotion
  (`GREATEST(currentUses - 1, 0)`) et recrédite le wallet exactement une fois
  (`benefitsReleasedAt`).
- **Idempotence e-mail** : tous les envois passent par `email_outbox.event_key` (unique) — retry
  cron/webhook sans doublon.
- **Anti-abus avis** : vote « utile » unique par (avis, utilisateur) avec 409 sur re-vote et
  interdiction de voter sur son propre avis.
- **Endpoints dangereux fermés** : `POST /api/seed` n'est ouvert qu'en environnement démo
  (`serverDemoSeedEnabled()`) et exige `x-seed-token` en production (comparaison en temps
  constant) ; les exports hébergeur répondent 403 aux voyageurs.
- **Brouillons et wishlists privées** non exposés (404 pour tout le monde sauf propriétaire).
- **Aucune route API sans appelant** hormis `/api/bookings/[id]/payment`, qui est volontairement
  un « tombeau » 410 (T-207) — vérifié dans le code.
- **Mode sombre** effectivement stylé (`globals.css`, `@custom-variant dark`) : le bouton du
  header n'est pas un contrôle mort.

---

## 6. Plan de correction (lots non régressifs)

| Lot | Contenu | Constats | Risque | Tests exigés |
| --- | --- | --- | --- | --- |
| **L1 — Effacement & rétention** | anonymisation étendue (`bookings`, `email_outbox`, `audit_log`) + `purgeTechnicalData()` dans le cron | N1, N2 | faible (transactions existantes, aucun changement d'API) | test d'intégration « aucune occurrence de l'adresse après DELETE » ; test de purge (session expirée supprimée, outbox récente conservée) |
| **L2 — Stock réel** | `bookedCount` additif dans `GET /api/rooms/[id]/availability` + affichage « reste X / déclaré Y » | N3 | faible (champ additif, valeurs existantes conservées) | test unitaire du calcul sur 3 cas (0, capacité atteinte, `stopSell`) + test API |
| **L3 — Dates** | helper unique de formatage « date seule » en UTC, remplacement de `toDate()` par des chaînes `YYYY-MM-DD`, validation IANA du fuseau, consommation réelle de `properties.timezone` | C1, C6 | moyen (touche l'affichage et deux règles métier) | vitest sous `TZ=Africa/Douala`, `TZ=Pacific/Kiritimati`, `TZ=America/Los_Angeles` : mêmes dates affichées/évaluées |
| **L4 — Demandes** | expiration paresseuse dans la transaction de création + quota incrémenté seulement après validation + message « réessayez dans X min » | C3, C4 | moyen (cœur du tunnel, couvert par les tests existants de booking) | tests d'intégration « 2ᵉ demande le jour J → acceptée si la 1ʳᵉ est expirée », « 12 essais invalides puis 1 valide → 201 » |
| **L5 — Catalogue & finitions** | suspension d'hôte → annonces masquées + demandes en attente traitées (+ e-mail), heure d'arrivée restituée et validée, période/export analytics | C2, C5, C7 | moyen | tests de cascade (annonce `suspended`, recherche vide, demande annulée) ; test API `estimatedArrival` invalide → 400 ; export CSV colonnes stables |

Ordre conseillé : **L1 → L2 → L3 → L4 → L5** (L1/L2 isolés et sans dépendance, L3 conditionne la
justesse des dates, L4 touche le tunnel, L5 dépend des décisions produit sur la suspension).

---

## 7. Annexe — reproduction

```bash
# 1) cloisonnement (crée un 2e hôte, une annonce draft, une conversation, deux wishlists puis nettoie)
node probe4.tmp.mjs                     # sonde supprimée après la campagne

# 2) suspension d'hôte : catalogue encore servi
PATCH /api/users/<hostId>/suspend {suspended:true}    # 200, sessions révoquées
GET   /hebergement/appartement-montmartre             # 200  (attendu 404/410)
GET   /recherche?city=Paris                           # annonce toujours listée

# 3) stock affiché vs vendable (chambre Standard, capacité 2)
SELECT d::date, COALESCE(ra.available_count, r.quantity) AS affiche,
       (SELECT count(*) FROM bookings b
         WHERE b.room_id = r.id AND b.status <> 'cancelled'
           AND d::date >= b.check_in AND d::date < b.check_out) AS sejours
FROM rooms r, generate_series('2026-09-24','2026-09-26','1 day') d
LEFT JOIN room_availability ra ON ra.room_id = r.id AND ra.date = d::date
WHERE r.id = '<roomId>';                              # affiche 2 / sejours 1

# 4) quota : essais invalides puis payload correct → 429
POST /api/bookings  (6 × payloads invalides)  puis payload valide  → 429
```

État final de la base après campagne (identique au seed) : `users 8 · properties 8 ·
bookings 33 · reviews 24 · conversations 0 · wishlists 0 · email_outbox 0 · audit_log 0`.
