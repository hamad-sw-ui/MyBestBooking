# Audit d’exécution approfondi post T-109 — sécurité restante, vérité métier et UX

- **Date** : 2026-08-23
- **Méthode** : inspection croisée page/client → handler → service → schéma,
  revue des invariants de crash et des données persistées. Les constats de ce
  document restent ouverts; aucun n’est présenté comme corrigé.

## AUD-110-01 — Injection XSS possible dans le JSON-LD de fiche property (P0)

**Chemin** : hôte → description property → `/hebergement/[slug]` public.

`src/app/(main)/hebergement/[slug]/page.tsx` construit `jsonLd` avec la
description contrôlée par l’hôte puis l’injecte ainsi :

```tsx
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
```

`JSON.stringify` n’échappe pas `<`. Une valeur contenant `</script><script>`
peut fermer le script JSON-LD et injecter du HTML/script. La CSP actuelle
contient `script-src 'unsafe-inline'`, ce qui augmente la gravité.

**Conséquence** : XSS public depuis un compte hôte, vol de session/actions au
nom d’un voyageur ou administrateur.

**Correction sans régression** : sérialiseur JSON script-safe centralisé qui
remplace `<`, `>`, `&`, U+2028/U+2029 par leurs séquences Unicode avant toute
injection; validation/neutralisation des descriptions HTML; suppression
progressive de `unsafe-inline` après inventaire des scripts légitimes. Ajouter
un test avec `</script>` et vérifier que le HTML ne crée qu’une balise script.

---

## AUD-110-02 — Fenêtre de crash entre remboursement PSP et état DB (P0)

**Chemin** : voyageur/admin annule booking payé → `cancelBooking()`.

La commande T-108 appelle `provider.refund()` avant la transaction qui persiste
`status=cancelled` et `refundStatus`. Une panne après acceptation du PSP et
avant commit laisse le booking `confirmed/paid` sans trace de refund. La clé
d’idempotence empêche le double débit lors d’un retry, mais ne crée ni
compensation automatique ni visibilité support si personne ne réessaie.

**Correction sans régression** : persister d’abord une opération financière
`refund_requested`/outbox avec clé provider, commit, appeler le PSP par worker,
puis finaliser booking via résultat/webhook. Les réservations historiques restent
inchangées; le nouveau journal permet reprise et dashboard de réconciliation.

---

## AUD-110-03 — Facteurs TOTP encore en clair et claim token consommable en course (P1)

T-108 a supprimé le QR tiers mais `two_factor_secret` et
`two_factor_pending_secret` restent en clair en base. Une fuite DB contourne
la 2FA. Par ailleurs `consumeToken()` fait SELECT puis UPDATE sans lock/condition
atomique : deux requêtes concurrentes peuvent observer un claim non consommé et
créer plusieurs sessions.

**Correction** : chiffrer les facteurs TOTP avec une clé dédiée, versionnée et
rotatable (AES-GCM, IV/tag par valeur, jamais la clé provider); consommer un
token par `UPDATE ... WHERE used_at IS NULL AND expires_at > now() RETURNING`
ou transaction `FOR UPDATE`. Tests concurrence claim et rotation de clé requis.

---

## AUD-110-04 — Montants multi-devise additionnés et présentés comme EUR (P1)

Analytics additionne `booking.total` de toutes les devises, puis appelle
`formatPrice()` sans monnaie booking. Le dashboard BestRewards, wallet et
checkout affichent aussi plusieurs symboles `€` en dur. Billing CSV est plus
honnête car il expose une colonne devise, mais ses totaux UI ne constituent pas
un ledger légal.

**Conséquence** : 100 EUR + 100 XAF peuvent devenir un faux « 200 EUR » ;
commission, panier et top properties deviennent non décisionnels.

**Correction** : première étape sûre : partitionner toute métrique par devise,
afficher la devise explicite et interdire les agrégats globaux. Une conversion
FX exige ensuite source, timestamp, arrondi, audit et ledger — jamais un taux
implicite de rendu.

---

## AUD-110-05 — Réglages et promesses produit encore décoratifs (P1)

- les toggles admin notifications, `minPasswordLength`, `sessionDays` et
  `twoFactorRequiredHosts` sont éditables mais non appliqués par le runtime;
- `PromotionForm` propose `free_night`, alors que le moteur le traite comme un
  montant fixe arbitraire;
- `ReferralCard` promet une récompense mais inscription/booking ne lisent aucun
  code ni n’attribuent d’avantage;
- BestRewards public annonce seuils 5/15 et cashback 5 % même si les réglages
  admin diffèrent; la page accueil parle de prix garantis, remboursement de
  différence et support 24/7 sans procédure de claim/SLA.

**Correction** : soit connecter chaque réglage à un service serveur testé, soit
retirer le contrôle et afficher une information honnête/non cliquable. Retirer
`free_night` jusqu’à un moteur qui sélectionne explicitement la nuit et la
snapshotte. Masquer le referral ou livrer attribution idempotente. Projeter les
paramètres BestRewards depuis `getSetting()` dans les pages. Ne jamais inventer
une garantie commerciale sans traitement de dossier.

---

## AUD-110-06 — Bornes dates et invariants room insuffisants (P1)

`stayNights`, `generate_series` recherche et GET availability ne bornent pas
leur plage. Un intervalle de plusieurs années peut générer calculs/réponses
volumineux. De plus un hôte peut réduire `quantity`, `maxOccupancy`, adultes ou
enfants sous des bookings futurs sans contrôle; il peut aussi modifier un stock
historique sans journal.

**Correction** : constante métier partagée (ex. 365 nuits) appliquée aux API,
recherche, alerte et UI; pagination availability par fenêtre 90 jours; refuser
ou planifier toute réduction qui rend un booking futur impossible; journaliser
les changements d’inventaire. Préserver les bookings existants, ne pas les
recalculer.

---

## AUD-110-07 — Conversations non uniques et rétention données incomplète (P2)

`POST /api/conversations` fait select puis insert sans unique index. Deux
requêtes concurrentes créent deux fils identiques. En parallèle, la suppression
RGPD anonymise `users`, mais les bookings et messages conservent email, téléphone
et contenu personnel sans durée de rétention explicitée.

**Correction** : unique index adapté à `booking_id` nullable + upsert/gestion
conflict; politique de rétention documentée par catégorie (fiscal, séjour,
message), jobs d’anonymisation différée et export/demande support vérifiable.
Ne pas hard-delete l’historique financier sans décision légale.

---

## AUD-110-08 — Actions visibles ou textes contradictoires (P2)

La fiche property contient encore les boutons cœur/partage d’en-tête sans
handler tandis que le cœur fonctionnel est sur les cartes. Des textes checkout
présentent une estimation client comme « Total payé/tout inclus » avant le quote
serveur. Le dashboard messages a été corrigé T-109, mais l’UI support reste un
mailto sans ticket/SLA.

**Correction** : brancher cœur/partage aux services existants, ou les rendre
non interactifs; afficher « estimation, vérifiée au paiement » jusqu’au quote
serveur; ne promettre aucun SLA dans l’aide tant qu’un ticketing n’existe pas.

## Ordre recommandé

1. **T-110 S/P0 immédiat** : JSON-LD script-safe, journal refund crash-safe,
   consommation token atomique, retrait des promesses trompeuses.
2. **T-111 C/P1** : chiffrement TOTP, devise/ledger, dates/inventory et
   settings réellement appliqués.
3. **T-112 S/P2** : referral/promos, conversations uniques, rétention,
   support/ticketing, UX restantes, navigateur CI et dépendances.

Toutes les corrections doivent conserver URLs, snapshots booking, outbox,
providers et migrations additives; elles doivent être testées en négatif et en
concurrence, pas seulement par code HTTP heureux.
