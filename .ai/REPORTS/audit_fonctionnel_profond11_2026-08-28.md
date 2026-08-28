# Audit fonctionnel profond n°11 — 2026-08-28

> Vérification à l'**exécution réelle** (HTTP + base + dév Turbopack port 3000),
> sur les 3 rôles (admin, hôte, client) + anonyme. Méthode : code source ET
> comportement constaté font foi ; chaque problème est expliqué avec sa
> solution **additive, sans régression**.
>
> Correctifs associés : **T-131**. Tous les tests (264), tsc, eslint,
> `ai:check` (19 OK · 1 warn · 0 fail) et `next build` passent.

---

## Synthèse

| # | Élément | Gravité | Constat | Traitement |
|---|---------|---------|---------|------------|
| F1 | Préférence **Devise** du profil | 🟠 Fonctionnalité « fantôme » | Choix enregistré mais jamais consommé (`convertAmount`/`formatMoney` = code mort) | ✅ Corrigé (aperçu converti + mention) |
| F2 | Préférence **Langue** du profil | 🟡 Confusion / attente | Choix enregistré, interface non traduite, aucune mention | ✅ Corrigé (mention honnête) |
| F3 | `pickLocalized` (i18n) | ⚪ Code mort / incomplet | Ne traduit que `en`, ignore `ar` ; jamais appelé | 📝 Documenté (hors périmètre V1) |

Zones explorées à l'exécution et confirmées **SAINES** : souhait partagé (jeton
unique, pas de fuite d'identité, isolation), 2FA complet, vérification d'email à
usage unique, activation de compte invité, promotions (bulk/suppression/édition),
plans tarifaires (édition/archivage/snapshot), calendrier de disponibilités +
stop-sell, annulation + portefeuille (restitution fidèle, frais d'annulation
caduques à J3 politique flexible), avis.

---

## F1 — La devise préférée est sauvegardée mais n'a aucun effet 🟠

### Problème
Le profil (`src/components/profile-form.tsx`) propose un sélecteur de devise
(EUR, USD, GBP, CHF, MAD, XAF) persisté en base (`users.currency`). Le module
`src/lib/i18n.ts` fournit pourtant tout le nécessaire :

- `RATES_FROM_EUR` (taux figés : USD 1,08 · GBP 0,85 · CHF 0,94 · MAD 10,9 · XAF 655,957) ;
- `convertAmount(amount, from, to)` ;
- `formatMoney(amount, currency, locale)`.

Mais un grep sur `src/app` + `src/components` montre que **ces fonctions ne sont
importées nulle part**. L'affichage passe par `formatPrice(amount, currency)` de
`src/lib/utils.ts`, qui fait un simple `Intl.NumberFormat("fr-FR", { currency })`
**sans aucune conversion** :

- Carte de recherche : `Dès {formatPrice(minPrice, property.minCurrency ?? "EUR")}` ;
- Fiche logement : `formatPrice(room.basePrice, room.currency ?? "EUR")`.

➡️ Un client qui choisit « USD » continue de voir tous les prix en euros : la
préférence se présente comme active mais n'agit pas. C'est une fonctionnalité
fantôme qui déçoit la confiance (et source d'erreurs de lecture de prix).

### Solution (T-131) — affichage d'aperçu uniquement, sans toucher aux paiements
Principe : convertir **uniquement les prix d'aperçu** (cartes de recherche et
prix « à partir de » des fiches), jamais les totaux de réservation, la
passerelle ni les remboursements (qui restent dans la devise de la chambre —
source de vérité).

1. Nouveau hook client **`src/lib/use-display-currency.ts`** : lit une fois
   `GET /api/auth/me` (promise mise en cache au niveau module → pas de requête
   par carte), renvoie `user.currency` ou `null` (anonyme / erreur).
2. **`property-card-client.tsx`** : si une devise d'affichage existe et diffère
   de la devise source, `Dès {formatMoney(convertAmount(...))}`, avec une ligne
   discrète **« Conversion indicative · paiement en EUR »** (info-bulle : taux
   figés, le paiement reste en devise de l'hébergement).
3. **`property-booking-card.tsx`** : même traitement sur le prix « à partir de ».
4. **`profile-form.tsx`** : mention sous le sélecteur — *« Aperçu des prix
   converti (taux indicatifs) ; paiement en devise de l'hébergement. »*

### Non-régression
- **Anonyme / devise EUR** : `displayCurrency` est `null` ou égal à la source →
  on retombe exactement sur l'ancien `formatPrice(...)` (vérifié : conversion
  EUR→EUR = montant identique ; devise inconnue = montant identique).
- Aucun montant **transactionnel** n'est converti (checkout, paiement,
  remboursement, wallet, taxes inchangés).
- Hook client isolé, pas de nouvelle route, pas de migration.

### Preuves
- `convertAmount(89,"EUR","USD")` → **96,12** (taux 1,08) ; `EUR→EUR` → 89 ;
  devise inconnue → 89 (identité). `formatMoney(96.12,"USD")` → `96,12 $US`.
- PATCH `/api/users/me {currency:"USD"}` → `user.currency = "USD"` ; la
  conversion s'applique ; restauration en `EUR` validée.
- Recherche anonyme et fiche logement rendent **HTTP 200** (prix hydratés côté
  client, inchangés en EUR).

---

## F2 — La langue préférée n'a aucun effet (interface non traduite) 🟡

### Problème
Le même sélecteur profil propose « Langue » (Français / English), persisté dans
`users.language`. Or **aucune infrastructure de traduction d'interface n'existe**
(toutes les chaînes de l'UI sont en dur en français) ; `pickLocalized` ne sert
qu'à choisir parmi des variantes de contenu (ex. nom/description traduits d'un
logement) et n'est lui-même jamais appelé.

➡️ Le sélecteur donne l'impression que l'interface va basculer en anglais, ce
qui n'arrive jamais.

### Solution (T-131)
Ne pouvant pas traduire l'intégralité de l'UI sans un chantier i18n lourd
(i18next/dictionnaires, hors périmètre et risque de régression élevé), le
correctif sûr et honnête est de **ne pas promettre ce qui n'existe pas** :
mention sous le sélecteur — *« Préférence mémorisée ; l'interface reste en
français en V1. »* Le choix reste enregistré, prêt pour une future
internationalisation (le champ et le stockage ne sont pas retirés).

> Piste future (hors T-131) : brancher `user.language` sur `pickLocalized` pour
> au moins les contenus multilingues des logements (nom/description), puis
> introduire des dictionnaires FR/EN pour les libellés.

---

## F3 — `pickLocalized` inopérant pour l'arabe ⚪ (documenté, non corrigé)

`pickLocalized(row, fields, locale)` de `src/lib/i18n.ts` ne gère que le
français (défaut) et l'anglais (`en`). Le profil n'expose de toute façon que
`fr`/`en` (pas `ar`), donc aucune incohérence visible aujourd'hui. **Code mort**
: fonction jamais appelée. Aucune action V1 ; à traiter avec le chantier i18ne
(étendre à `ar` + dictionnaires RTL) si l'arabe est proposé.

---

## Zones confirmées saines à l'exécution

- **Liste de souhaits partagée** : PATCH `/api/wishlists {isPublic:true}` crée un
  `shareToken` (uuid v4) ; accès anonyme `GET /api/wishlists/shared/<token>` →
  200 **sans fuite d'`userId`** (items exposent uniquement
  id/slug/name/city/country/mainImage/notes) ; mauvais jeton → 404 ; un hôte ne
  peut pas modifier la liste d'un client (404, isolation `eq(userId)`). UI :
  bouton Partager copie l'URL, rotation du jeton, repasser en privé.
- **2FA** : setup (`{password}`) → secret en attente ; verify (`{code}` TOTP) →
  activé ; connexion sans code → **401 « Code 2FA requis »** ; avec code
  speakeasy → 200 ; mauvais code → **401 « Code 2FA invalide »** ; désactivation
  exige mot de passe + code.
- **Vérification d'email** : email écrit dans `.data/mails/console_*.txt` ;
  1er GET du lien → 307 `?ok=1` ; **rejeu → 307 `?ok=0`** (jeton à usage unique).
- **Activation compte invité** : `activer-compte` poste sur
  `/api/auth/reset-password` avec `{claimGuest:true}` (endpoint réel).
- **Promotions** : activation/désactivation/suppression en masse
  (`/api/admin/bulk`), filtres + suppression par ligne, PATCH/DELETE
  `/api/promotions/[id]` (isActive, maxUses, validUntil avec garde validFrom).
- **Plans tarifaires** : création/édition, archivage/réactivation, snapshots des
  réservations préservées.
- **Disponibilités** : mise à jour par lot, stop-sell, pagination 90 jours.
- **Annulation + portefeuille** : annulation J+3 en politique flexible → frais
  caduques (jours gratuits), remboursement total ; le crédit portefeuille utilisé
  (25,00) est **restitué à l'identique** (wallet 0 → 25,00 après annulation).

---

## Bilan validation T-131

- `npx tsc --noEmit` → **OK**
- `npx eslint` (fichiers modifiés) → **OK**
- `npx vitest run` → **264 / 264**
- `npm run ai:check` → **19 OK · 1 warn · 0 fail** (R15/R18/R19 : pas d'UI morte,
  tous les liens/actions câblés)
- `npm run build` → **OK** (toutes les routes générées)
- Fichiers touchés : `src/lib/use-display-currency.ts` (nouveau),
  `src/components/property-card-client.tsx`,
  `src/components/property-booking-card.tsx`,
  `src/components/profile-form.tsx` — **additif, aucune migration, aucune
  nouvelle route, aucun montant transactionnel modifié**.
