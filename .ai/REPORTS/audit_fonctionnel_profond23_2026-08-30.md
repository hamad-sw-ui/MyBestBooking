# Audit fonctionnel profond n°23 — T-148 — 2026-08-30

**Demande :** analyse profonde, à l'exécution, des scénarios/éléments
inachevés ou mal pensés (pages, boutons, flux), avec explication du problème
et solution **sans régression**.

Méthode : exécution réelle DEV (port 3000), 3 rôles (client/hôte/admin) +
anonyme. Environnement restauré (re-clone → reset `ccfdea7`, install, PG
55432, db:push, seed). Données de test créées puis **nettoyées** (chambre
test, wishlist, utilisateur jetable anonymisé, réponse d'avis, vote utile,
téléphone — revenu à l'état de seed : 8 utilisateurs actifs).

**Conclusion : aucune anomalie bloquante, aucun correctif de code nécessaire.**
Tous les scénarios testés se comportent correctement (validation, garde-fous
d'autorisation, états). Détail ci-dessous.

---

## Scénarios vérifiés à l'exécution et jugés SAINS

### Gestion des chambres (hôte)
- Création chambre valide (hôte) → **201**.
- Prix de base négatif → **400** « Le prix de base doit être strictement positif ».
- Création par un **client** → **401/403** ; modification (PUT) par un client → **403**.
- Modification du prix par l'hôte propriétaire → **200**.
- Désactivation (`isActive:false`) → la chambre n'est **plus réservable**
  (« Chambre non disponible », 400).
- Garde de propriété dans `rooms/[id]` : seul le propriétaire ou un admin
  peut modifier/supprimer (sinon 403).

### Réponses aux avis (hôte) & votes « utile »
- L'hôte propriétaire peut répondre à un avis sur **sa** propriété → **200**
  (`hostReply` enregistré) ; réponse vide → **400**.
- Un **client** ne peut pas répondre à un avis → **403** « Accès refusé ».
- Vote « utile » : anonyme → **401** ; vote connecté → **200** ; re-vote →
  **409** « déjà marqué comme utile » (anti-double-comptage + rate-limit).

### Préférences utilisateur
- Langue `en` + devise `USD` → **200** ; langue non supportée (`ar`) →
  **400** « Langue non supportée » ; devise inconnue (`XYZ`) → **400**
  « Devise non supportée » (cohérent avec T-145).
- Prénom vide / téléphone trop long → **400**.

### Garde-fous de réservation
- Capacité dépassée (10 adultes dans une chambre max 2) → **409**
  « Cette chambre accepte au maximum 2 adultes » (classe `BookingRuleError`).
- Départ avant arrivée → **400** ; arrivée dans le passé → **400** ;
  réservation anonyme (payload complet) → **401** « Veuillez vous connecter ».

### Sécurité / autorisations
- **Auto-promotion de rôle impossible** : `PATCH /api/users/me {role:"admin"}`
  est ignoré, le rôle reste `customer` (le champ n'est pas dans le schéma).
- Client/hôte sur routes admin (`/api/admin/audit`, settings) → **403**.
- Pages dashboard non autorisées → redirection **307** (garde de layout) ;
  la page admin users lit la base côté serveur avec garde rôle (pas d'API
  REST exposée → pas de surface d'attaque).

### Propriétés (hôte/admin)
- Hôte modifie sa propriété → **200** ; tente de changer le **statut** →
  **403** (réservé admin) ; tente de changer la **commission** → **403**
  (réservé admin, T-145) ; un client modifie une propriété → **403**.

### Suspension / réactivation d'utilisateurs (admin)
- Admin suspend un utilisateur → **200** ; l'utilisateur suspendu ne peut
  plus se connecter → **401** ; réactivation → **200** puis login rétabli.
- L'admin ne peut **pas se suspendre lui-même** → **400**.
- Un non-admin ne peut pas suspendre → **403**.

### Favoris (wishlists)
- Création de liste → **201** ; ajout d'un hébergement → **201** ; doublon →
  **400** « déjà dans la liste » ; propriété inexistante → **404**.

### Recherche avancée
- Filtre équipements (`amenities=pool`) : tous les résultats ont bien
  `pool` ; filtre capacité (`guests=4`) ; filtre `type=villa` : résultats
  tous de type villa ; type invalide → 0 résultat (filtre sans correspondance,
  pas d'erreur). État « 0 résultat » géré par l'UI.

### Avis (dépôt)
- La page `/mes-reservations/avis/[id]` appelle `notFound()` si l'utilisateur
  n'est pas le propriétaire ou si le séjour n'est pas éligible
  (`isReviewEligible` = `status === "completed"` ET checkout passé). Vérifié :
  réservation future et réservation d'autrui affichent bien le **contenu 404**
  (soft-404 streamé, cf. T-146 pour le code HTTP 200 documenté).

### Pages
- Toutes les pages principales (client/anonyme) répondent **200** : accueil,
  recherche, BestRewards, favoris, mes-réservations, aide, confidentialité,
  mentions légales.
- Pages dashboard hôte : `/dashboard`, properties, bookings, messages,
  analytics, billing, promotions, settings, reviews, rooms, et
  `/dashboard/rooms/[id]/calendrier` → **200**.
- Pages admin : `/dashboard`, audit, settings, users → **200** pour l'admin.
- Paramètres admin : GET **200** (client **403**) ; PATCH par clé : client
  **403**, clé invalide **404**.

### Notifications
- Il n'existe pas de centre de notifications générique ni de table dédiée :
  les notifications « vivent » via les **messages** (badge de non-lus dans
  l'en-tête), les **alertes de prix** et les **e-mails** transactionnels.
  C'est un choix de conception cohérent, pas un élément mort : aucun bouton
  ne pointe vers une route `/notifications` inexistante (vérifié R18/R19).

---

## Points de vigilance (non bloquants, déjà documentés)

1. **Soft-404 HTTP 200** : les pages qui appellent `notFound()` pendant le
   rendu streamé renvoient un code 200 (contenu 404 + `noindex`) — déjà
   analysé en T-146, mitigé SEO. Aucune régression.
2. **Règles métier réservation en 409** : les violations de règles
   (capacité, plan tarifaire, code promo) renvoient 409 via `BookingRuleError`,
   cohérent entre elles ; les erreurs de validation de formulaire renvoient
   400. C'est une distinction volontaire (conflit d'état vs entrée invalide).
3. **Dette Stripe / e-mails** : l'envoi réel d'e-mails (Resend) et le paiement
   carte (Stripe) restent conditionnés aux clés externes (T-145) ; les liens
   `mailto:` de contact plateforme (`support@`, `partners@`, `privacy@`) et la
   messagerie client↔hôte sont, eux, pleinement fonctionnels côté interface.

**Aucune modification de code** pour cet audit. La base de test a été rendue
à son état de seed.
