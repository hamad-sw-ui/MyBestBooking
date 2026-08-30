# Audit fonctionnel profond n°7 — MyBestBooking

- **Date** : 2026-08-28 · **Branche** : `arena/01a042cf-mybestbooking` (HEAD T-126 `1725c9c`)
- **Méthode** : exécution réelle (dev server, sessions fraîches customer/host/admin + anonyme), au-delà du HTTP 200 ; code relu. Données de test intégralement nettoyées.
- **Périmètre neuf** (peu ou pas couvert par les audits 1–6) : rate-plans & disponibilités, wishlist partagée, 2FA, messagerie/pièces jointes, alertes de prix, facturation/analytics, pages compte/bestrewards, garde-fous de réservation, settings admin, footer/navigation.

## Synthèse

Le produit est très mûr. Cette passe trouve **2 écarts concrets à corriger** (tous deux des régressions de robustesse/cohérence par rapport à ce qui a déjà été fait ailleurs) et **1 détail d'interface**. Aucun problème d'autorisation ou de fuite de données nouveau.

| Ref | Sévérité | Sujet |
|-----|----------|-------|
| **P1** | 🔴 Moyenne | `POST /api/price-alerts` et `POST /api/wishlists` (ajout) sur une propriété **inexistante** → **HTTP 500** (violation de clé étrangère non gérée) au lieu d'un 404/400 propre. |
| **P2** | 🟠 Moyenne-basse | L'upload des **pièces jointes de messagerie** (`/api/uploads`) vérifie encore le seul MIME déclaré par le client : le durcissement « magic bytes » du T-126 n'a été appliqué qu'à l'upload **public** (`/api/properties/upload`). |
| **P3** | 🟡 Basse | L'export CSV de facturation ignore d'éventuels paramètres `from/to` (le front n'en envoie jamais, donc sans impact aujourd'hui). |

---

## P1 — Ajout favori / alerte prix sur une propriété inexistante → 500

### Preuves d'exécution

```
POST /api/price-alerts  { propertyId: "00000000-…-000000000000", maxPrice: 100 }
→ 500 {"error":"Erreur"}            # attendu : 404/400
POST /api/wishlists      { wishlistId: <mienne>, propertyId: "00000000-…-000000000000" }
→ 500 {"error":"Une erreur est survenue"}   # attendu : 404/400
```

### Cause

`priceAlerts.propertyId` et `wishlistItems.propertyId` sont des clés étrangères **NOT NULL** vers `properties.id` (`src/db/schema.ts:70`, etc.). Les deux routes insèrent directement la valeur fournie **sans vérifier que la propriété existe** :

- `src/app/api/price-alerts/route.ts` (insertion `priceAlerts`) — seule l'unicité (user, property) est vérifiée.
- `src/app/api/wishlists/route.ts` (branche `body.propertyId` → insert `wishlistItems`) — la propriété de la wishlist est vérifiée, mais pas la propriété ajoutée.

La base rejette l'insertion (FK), l'erreur n'est pas mappée → le `catch` générique renvoie 500.

### Pourquoi c'est un problème

- Un 500 est un signal « bug serveur » côté client ; le formulaire ne peut pas afficher un message clair (« hébergement introuvable »).
- C'est incohérent avec le reste de l'API : les routes métier (`bookings`, `conversations`, `reviews…`) vérifient toutes l'existence de la propriété et renvoient 400/404.
- Aucun risque de données : la FK garantit qu'aucune ligne orpheline n'est écrite (vérifié en base : 0 alerte/0 item orphelin après les tests).

### Solution (sans régression)

Avant l'insertion, dans chacune des deux routes, charger la propriété cible :

```ts
const [property] = await db
  .select({ id: properties.id, status: properties.status })
  .from(properties)
  .where(eq(properties.id, data.propertyId))
  .limit(1);
if (!property) {
  return NextResponse.json({ error: "Hébergement introuvable" }, { status: 404 });
}
```

- C'est **purement additif** : les requêtes valides (propriété existante) ont le même comportement (201), un simple `SELECT … LIMIT 1` indexé par PK est ajouté.
- On peut (optionnel, défensif) aussi accepter une propriété non `active` pour les **favoris** (on peut garder un hébergement bientôt en ligne) mais, par cohérence avec le parcours de recherche/réservation, on peut exiger `status = 'active'`. Choief retenu : **exiger l'existence seulement** pour les alertes (le cron fait déjà un `leftJoin` et ignore les propriétés nulles) et **existence** pour les favoris ; on ne durcit pas sur `active` pour ne pas casser un favori sur une propriété momentanément suspendue (l'item reste en base, il est juste filtré à l'affichage).
- Le `catch` générique reste en place pour les autres imprévus.

---

## P2 — Pièces jointes de messagerie : MIME déclaré non vérifié (magic bytes manquants)

### Preuve d'exécution

```
POST /api/uploads  (champ file : texte "this is not an image…" avec Content-Type image/jpeg)
→ 200 {"key":"uploads/cc729670-….jpg","mimeType":"image/jpeg"}   # accepté !
```

(Rappel T-126 : la même tentative sur `/api/properties/upload` est maintenant rejetée en 400.)

### Cause

`src/app/api/uploads/route.ts` (ligne ~87) valide `file.type` (MIME déclaré) puis stocke le buffer en réutilisant ce MIME, **sans `sniffImageMime`**. Le T-126 a durci seulement l'upload public des photos de bien.

### Atténuations existantes (à ne pas déstabiliser)

- Connexion requise (401 anonyme), rate-limit, taille plafonnée, anti path-traversal sur la clé.
- Le stockage est **privé** : le téléchargement passe par `/api/messages/attachments/[id]` avec contrôle `checkParticipant` (seuls l'hôte et le voyageur du fil y accèdent), et la clé est préfixée par l'utilisateur.
- La pièce jointe est en outre rattachée au message une seule fois (`attachedAt`, `FOR UPDATE`) ; on ne peut pas servir la clé d'un autre utilisateur (garde `attachmentKey.startsWith('uploads/<userIdPrefix>-')`).

Le risque est donc plus faible que pour les photos publiques, mais le contenu stocké peut être n'importe quoi (un exécutable renommée `.jpg`) : on perd la garantie « ce sont des images ».

### Solution (sans régression)

Appliquer le **même** helper `sniffImageMime` qu'au T-126 dans `/api/uploads` :

```ts
const buffer = Buffer.from(await file.arrayBuffer());
const realMime = sniffImageMime(buffer);
if (!realMime || !ALLOWED_UPLOAD_MIMES.has(realMime)) {
  return NextResponse.json({ error: "Le fichier n'est pas une image valide (JPEG, PNG, WebP ou GIF)." }, { status: 400 });
}
const stored = await (await getUploader()).put(buffer, realMime, user.id);
```

- Réutilise le helper déjà testé (6 tests unitaires T-126). Les vraies images passent ; les fichiers déguisés sont rejetés à 400.
- La ligne `upload_objects.mimeType` doit alors stocker `realMime` (et non le MIME déclaré) — cohérent avec le commentaire existant « Le MIME est une propriété de l'objet uploadé, jamais du navigateur ».

---

## P3 — Export facturation : paramètres de période ignorés (détail)

`GET /api/dashboard/billing/export?from=…&to=…` reconstruit toujours la même requête (toutes les réservations payées, non annulées de l'hôte/admin) et **ne lit pas** `from`/`to`. Le front (`dashboard/billing/page.tsx`) lie le bouton vers `/api/dashboard/billing/export` **sans paramètres**, et chaque ligne « Télécharger … de la période » pointe aussi vers l'export global.

- **Impact actuel : nul** sur les données (l'export est correct, juste non filtrable).
- C'est une **incohérence d'intention** : le libellé « de la période » suggère un filtrage qui n'existe pas.
- **Solution (choix à confirmer, non bloquant)** : soit (a) lire `from`/`to` validés (`YYYY-MM-DD`, `from <= to`) et les ajouter au `WHERE (createdAt >= from AND createdAt <= to)`, soit (b) ajuster le libellé/bouton pour dire « Export complet ». La voie (a) est recommandée et peu risquée.

---

## Zones vérifiées SAINES à l'exécution (à ne pas régresser)

- **Réservation** : 0 nuit (`checkIn == checkOut`) → 400 ; `numAdults = 0` → 400 ; chambre n'appartenant pas à la propriété → 400 « Chambre non disponible » (la requête chambre filtre bien `room.propertyId = data.propertyId`).
- **Rate-plans** : `discountPercentage > 100` → 400 ; `cancellationPolicy` hors enum → 400 ; plan valide → 201 ; isolation propriétaire (403/404 selon UUID).
- **Pièces jointes / facture** : UUID invalide → 400, inexistant → 404, anonyme → 401 ; **réservation d'autrui** (GET + invoice) → 403.
- **Avis** : propriété vérifiée, unicité par réservation (`FOR UPDATE`), éligibilité « séjour terminé », rate-limit, modération pilotée par réglage (T-125) ; schémas de notes 1–10 bornés.
- **Messagerie** : rate-limit 60/h, `checkParticipant` strict (403 sinon), hôte doit fournir un `bookingId`, résa d'autrui → 403, propriétaire de la pièce jointe vérifié, MIME relu depuis `upload_objects`.
- **2FA** : mauvais mot de passe au setup → 401 ; verify sans secret pending → 400 ; code non numérique → 400 ; remplacement d'un facteur actif exige le code courant.
- **Wishlist partagée** : création `isPublic:true` → `shareToken` ; accès anonyme API + page → 200 ; token inconnu → 404 ; `userId` jamais exposé.
- **Settings admin** : clé inconnue → 404 ; hôte → 403 (GET et PATCH) ; schémas bornés (taxRate, commission).
- **Navigation** : sidebar desktop **et** header mobile filtrent les liens par rôle ; « Paramètres » (admin-only) n'apparaît pas pour un hôte (pas de lien mort R18/R19). Footer : liens morts volontairement remplacés par du texte grisé.
- **Recherche** : `<script>` dans `q` → 200 (échappé au rendu), tri inconnu toléré, filtres incohérents → 0 résultat (T-126).
- **Paiement** : provider `mock` en démo → réservation `confirmed`/`paid` sans Stripe ; reprise d'intent (`/payment`) isolée (403 résa d'autrui).

## Aucune donnée de test résiduelle

- Rate-plan de test supprimé ; wishlist « Audit7 Partage » et « Audit7 FK » supprimées ; fausse pièce jointe (`upload_objects` + fichier disque) supprimée ; aucune alerte/aucun item orphelin en base.
