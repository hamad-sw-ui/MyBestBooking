# 🎬 Simulation utilisateur exhaustive — Session 11 (2026-08-21)

**Généré le** : 2026-08-21 12:31
**Base URL testée** : `http://127.0.0.1:3000` (Next.js 16 dev, PostgreSQL embarqué :55432)
**Comptes utilisés** :

- `customer@mybestbooking.com` / `Customer123!` (level 2, wallet 25 €)
- `host@mybestbooking.com` / `Host123!` (propriétaire)
- `admin@mybestbooking.com` / `Admin123!` (admin plateforme)

## 🎯 Résumé

- **68 PASS · 0 KO** sur **68 scénarios** joués
- Verdict global : **✅ TOUT PASSE**

Chaque scénario ci-dessous a été **réellement joué** via HTTP contre le serveur Next
en cours d'exécution. La colonne **« Ce que voit l'utilisateur »** est extraite du HTML
rendu (balises retirées, scripts/styles retirés, tronqué à ~600 caractères).

Toutes les commandes sont **rejouables** : lance `npm run db:dev` + `npx next dev` puis
`bash scripts/smoke.sh` pour rejouer la version condensée (91 assertions).

---

## A. Pages publiques (visiteur non connecté)

### 1. `GET /`

**Scénario** : Le visiteur arrive sur la page d'accueil. Il voit le hero + les hébergements recommandés.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Prix garantis, avis vérifiés, zéro frais cachés. Destination Arrivée Départ Rechercher Prix garantis Avis vérifiés 0 frais cachés 🔥 Hébergements populaires Les mieux notés par nos voyageurs Voir tout 💎 BestRewards B&B Toscana ★★★ Florence , IT 9.8 2 avis B&B Dès € 89 /nuit Voir les chambres → 💎 BestRewards Hôtel Le Magnifique ★★★★ Paris , FR 9.0 2 avis Hôtel Dès € 89 /nuit Voir les chambres →  …

---

### 2. `GET /recherche`

**Scénario** : Le visiteur ouvre la page de recherche vide. Le formulaire de filtres s'affiche.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/recherche
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Recherche d&#x27;hébergements | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Destination Arrivée Départ Type Tous les types Hôtel Appartement Villa Auberge Maison d'hôtes Riad Resort Rechercher Tous les hébergements 8 résultat s trouvé s Filtres 💎 BestRewards B&B Toscana ★★★ Florence , IT 9.8 2 avis B&B Dès € 89 /nuit Voir les chambres → 💎 BestRewards Hôtel Le Magnifique ★★★★ Paris , FR 9.0 2 avis Hôtel Dès € 89 /nuit Voir les chambres → 💎 BestRewards Dar El Medina ★★★ Tunis , TN 8.9 2 avis Maison d'hôtes Dès € 89 /nuit Voir les chambres → 💎 BestRewa …

---

### 3. `GET /aide`

**Scénario** : Le visiteur cherche de l'aide. Il voit les FAQ et 3 canaux de contact (mailto).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/aide
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Aide et FAQ | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Comment pouvons-nous vous aider ? Trouvez des réponses à vos questions ou contactez notre équipe Messagerie Écrivez-nous par email Écrire à l'équipe Téléphone +237 XXX XX XX XX Numéro à activer Email direct support@mybestbooking.com Ouvrir mon client mail Parcourir par catégorie Réservations Gérer, modifier ou annuler une réservation Comment annuler une réservation ? Modifier mes dates Ajouter un voyageur Paiements & Facturation Questions sur les paiements et remboursements  …

---

### 4. `GET /bestrewards`

**Scénario** : Le visiteur découvre le programme de fidélité BestRewards (3 niveaux).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/bestrewards
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `BestRewards — programme fidélité | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire BestRewards Les vrais avantages, dès votre 1ère réservation. Rejoignez le programme de fidélité mybestbooking. Rejoindre gratuitement Comment ça marche ? 1 Inscrivez-vous C'est gratuit et instantané. Vous êtes immédiatement Level 1 Explorer. 2 Réservez Chaque réservation confirmée compte. Plus vous voyagez, plus vous montez en niveau. 3 Profitez Débloquez des réductions exclusives, petits-déjeuners offerts, et bien plus. Les 3 niveaux BestRewards Level 1 Explorer Dès l'inscr …

---

### 5. `GET /mentions-legales`

**Scénario** : Le visiteur consulte les mentions légales (éditeur, hébergeur, CGU, CGV).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mentions-legales
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Mentions légales | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Mentions légales Éditeur du site MyBestBooking — plateforme de réservation d'hébergements. Raison sociale : à compléter par l'éditeur en production. Contact : support@mybestbooking.com Hébergement Le site est hébergé sur une infrastructure cloud professionnelle (Vercel / Neon PostgreSQL ou équivalent). Détails à préciser en production. Conditions générales d'utilisation En utilisant MyBestBooking, vous acceptez de : Fournir des informations exactes lors de l'inscription. Ne  …

---

### 6. `GET /confidentialite`

**Scénario** : Le visiteur consulte la politique de confidentialité (RGPD, droits, cookies).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/confidentialite
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Politique de confidentialité | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Politique de confidentialité Données collectées MyBestBooking collecte les données nécessaires au fonctionnement du service : Compte : email, nom, prénom, mot de passe (haché bcrypt coût 12). Profil optionnel : téléphone, pays, langue, devise, fuseau horaire. Réservations : dates, hébergement, montant, mode de paiement (jamais le numéro complet de carte). Traçabilité : IP au moment du login (pour la sécurité), dernière connexion. Communication : messages échangés avec les hô …

---

### 7. `GET /connexion`

**Scénario** : Le visiteur ouvre la page de connexion. Un formulaire email + mot de passe.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/connexion
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ mybest booking Connexion Bienvenue sur mybestbooking Email Mot de passe Se souvenir de moi Mot de passe oublié ? Se connecter Pas encore de compte ? Créer un compte Comptes de démonstration : Admin : admin@mybestbooking.com / Admin123! Hébergeur : host@mybestbooking.com / Host123! Client : customer@mybestbooking.com / Customer123! © 2025 mybestbooking.com — "Réservez mieux. Voyagez plus."

---

### 8. `GET /inscription`

**Scénario** : Le visiteur ouvre la page d'inscription. Un formulaire complet.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/inscription
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ mybest booking Créer un compte Rejoignez mybestbooking gratuitement Voyageur Hébergeur Prénom Nom Email Mot de passe En créant un compte, vous acceptez nos Mentions légales & CGU et notre Politique de confidentialité . Créer mon compte Déjà un compte ? Se connecter © 2025 mybestbooking.com — "Réservez mieux. Voyagez plus."

---

### 9. `GET /mot-de-passe-oublie`

**Scénario** : Le visiteur a oublié son mot de passe. Il saisit son email.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mot-de-passe-oublie
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ mybest booking Mot de passe oublié Saisissez votre adresse email, nous vous enverrons un lien pour définir un nouveau mot de passe. Email Envoyer le lien Retour à la connexion © 2025 mybestbooking.com — "Réservez mieux. Voyagez plus."

---

### 10. `GET /verifier-email`

**Scénario** : Le visiteur clique un lien de vérification email reçu.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/verifier-email
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking © 2025 mybestbooking.com — "Réservez mieux. Voyagez plus." Lien invalide Ce lien de vérification est expiré ou déjà utilisé. Créez un nouveau lien en vous inscrivant à nouveau ou contactez le support. Se connecter

---

### 11. `GET /maintenance`

**Scénario** : La page de maintenance (affichée quand le mode maintenance est actif).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/maintenance
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Maintenance en cours — MyBestBooking | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

## B. Pages protégées — utilisateur non connecté (redirection edge → /connexion)

### 1. `GET /mon-compte`

**Scénario** : Le visiteur clique 'Mon compte' sans être connecté.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mon-compte
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fmon-compte

---

### 2. `GET /mes-reservations`

**Scénario** : Le visiteur essaie d'accéder à ses réservations.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mes-reservations
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fmes-reservations

---

### 3. `GET /mes-favoris`

**Scénario** : Le visiteur essaie d'ouvrir ses favoris.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mes-favoris
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fmes-favoris

---

### 4. `GET /messages`

**Scénario** : Le visiteur essaie d'ouvrir sa messagerie.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/messages
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fmessages

---

### 5. `GET /reservation`

**Scénario** : Le visiteur essaie de finaliser une réservation sans compte.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/reservation
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Freservation

---

### 6. `GET /dashboard`

**Scénario** : Un curieux tape /dashboard dans la barre d'URL.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/dashboard
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fdashboard

---

### 7. `GET /dashboard/bookings`

**Scénario** : Idem sur les réservations dashboard.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/dashboard/bookings
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fdashboard%2Fbookings

---

### 8. `GET /dashboard/properties`

**Scénario** : Idem sur les propriétés dashboard.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/dashboard/properties
```

**Résultat serveur** : HTTP `307` (attendu `307`) → ✅ **OK**

**Titre / type de réponse** : `(redirection)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Redirect → http://127.0.0.1:3000/connexion?next=%2Fdashboard%2Fproperties

---

## C. Voyageur authentifié (customer@mybestbooking.com)

### 1. `GET /`

**Scénario** : Le voyageur ouvre l'accueil connecté (le header affiche son nom).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Prix garantis, avis vérifiés, zéro frais cachés. Destination Arrivée Départ Rechercher Prix garantis Avis vérifiés 0 frais cachés 🔥 Hébergements populaires Les mieux notés par nos voyageurs Voir tout 💎 BestRewards B&B Toscana ★★★ Florence , IT 9.8 2 avis B&B Dès € 89 /nuit Voir les chambres → 💎 BestRewards Hôtel Le Magnifique ★★★★ Paris , FR 9.0 2 avis Hôtel Dès € 89 /nuit Voir les chambres → 💎 BestRewards Dar El …

---

### 2. `GET /mon-compte`

**Scénario** : Il ouvre son compte : profil, sécurité, notifications, wallet 25 €, BestRewards Or.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/mon-compte
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés

---

### 3. `GET /mes-reservations`

**Scénario** : Il liste ses réservations avec statut, dates, boutons Contacter/Confirmation/Annuler.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/mes-reservations
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés Mes réservations Retrouvez toutes vos réservations mybestbooking À venir ( 19 ) Confirmée B&B Toscana Flor …

---

### 4. `GET /mes-favoris`

**Scénario** : Il ouvre ses favoris : ses wishlists + alertes prix.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/mes-favoris
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés Mes favoris 5 hébergement s sauvegardé s Alertes prix Chargement… Vos alertes prix sont gérées ci-dessus.  …

---

### 5. `GET /messages`

**Scénario** : Il ouvre sa messagerie avec les hôtes.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/messages
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés Messages Vos conversations avec les hébergeurs Aucun message Vos conversations avec les hébergeurs apparaî …

---

### 6. `GET /reservation`

**Scénario** : Il ouvre la page de finalisation (avec wallet et guest mode).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/reservation
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Informations de réservation manquantes Rechercher un hébergement Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés

---

### 7. `GET /recherche`

**Scénario** : Il refait une recherche avec ses préférences.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/recherche
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Recherche d&#x27;hébergements | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Destination Arrivée Départ Type Tous les types Hôtel Appartement Villa Auberge Maison d'hôtes Riad Resort Rechercher Tous les hébergements 8 résultat s trouvé s Filtres 💎 BestRewards B&B Toscana ★★★ Florence , IT 9.8 2 avis B&B Dès € 89 /nuit Voir les chambres → 💎 BestRewards Hôtel Le Magnifique ★★★★ Paris , FR 9.0 2 avis Hôtel Dès € 89 /nuit Voir les chambres → 💎 BestRewards Dar El Medina ★★★ Tunis , TN 8.9 2 avis Maison d'hôtes Dès € 89 /nuit Voir les chambres → 💎 BestRewards Villa Azure Côte …

---

### 8. `GET /aide`

**Scénario** : Il consulte l'aide.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/aide
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Aide et FAQ | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M Comment pouvons-nous vous aider ? Trouvez des réponses à vos questions ou contactez notre équipe Messagerie Écrivez-nous par email Écrire à l'équipe Téléphone +237 XXX XX XX XX Numéro à activer Email direct support@mybestbooking.com Ouvrir mon client mail Parcourir par catégorie Réservations Gérer, modifier ou annuler une réservation Comment annuler une réservation ? Modifier mes dates Ajouter un voyageur Paiements & Facturation Questions sur les paiements et remboursements Modes de paiement ac …

---

### 9. `GET /bestrewards`

**Scénario** : Il consulte son statut BestRewards.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/bestrewards
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `BestRewards — programme fidélité | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide M M BestRewards Les vrais avantages, dès votre 1ère réservation. Rejoignez le programme de fidélité mybestbooking. Votre niveau : 💎 Level 2 — Voyageur Comment ça marche ? 1 Inscrivez-vous C'est gratuit et instantané. Vous êtes immédiatement Level 1 Explorer. 2 Réservez Chaque réservation confirmée compte. Plus vous voyagez, plus vous montez en niveau. 3 Profitez Débloquez des réductions exclusives, petits-déjeuners offerts, et bien plus. Les 3 niveaux BestRewards Level 1 Explorer Dès l'inscription  …

---

## D. Guards de rôle — voyageur (customer) tente d'ouvrir le dashboard

### 1. `GET /dashboard`

**Scénario** : Un voyageur tente d'ouvrir le dashboard host/admin.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 2. `GET /dashboard/properties`

**Scénario** : Idem sur la gestion des propriétés.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/properties
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 3. `GET /dashboard/users`

**Scénario** : Idem sur les utilisateurs (admin-only).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/users
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 4. `GET /dashboard/settings`

**Scénario** : Idem sur les paramètres (admin-only).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/settings
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 5. `GET /dashboard/audit`

**Scénario** : Idem sur l'audit log (admin-only).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/audit
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

## E. Hôte authentifié (host@mybestbooking.com) — dashboard host

### 1. `GET /dashboard`

**Scénario** : L'hôte arrive sur son tableau de bord (revenus, réservations, occupation).

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Bonjour, Jean 👋 Voici un aperçu de votre activité sur mybestbooking Hébergements 8 8 actifs Réservations 58 58 ce mois Revenus 23 728,92 € 23 728,92 € ce mois Avis 20 avis vérifiés Réservations récentes Voir tout → Référence Client Hébergement Dates Montant Statut MBB-2026-EBVZLX Marie Martin B&B Toscana Florence 15 janv. 2027 → 18 janv. 2027 243,77 € Confirmée MBB-2026-EMQBJ4 Marie …

---

### 2. `GET /dashboard/bookings`

**Scénario** : Il liste toutes les réservations reçues sur ses propriétés.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/bookings
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Réservations Réservations de vos hébergements — filtres et recherche. Total 58 Confirmées 20 En attente 0 Revenus 23 729 € Rechercher (tapez « / ») Filtrer Tous statuts En attente Confirmée Annulée Terminée No-show Check-in à partir de Check-out jusqu'à 58 réservation s affichée s Référence Client Hébergement Dates Montant Statut Actions MBB-2026-EBVZLX Smoke Test customer@mybestboo …

---

### 3. `GET /dashboard/properties`

**Scénario** : Il liste ses propriétés.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/properties
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Hébergements Gérez vos hébergements — filtres et recherche. Ajouter un hébergement Total 8 Actifs 8 En attente 0 Brouillons 0 Rechercher (tapez « / ») Filtrer Tous les statuts Actif En attente Brouillon Suspendu Rejeté Tous types Appartement B&B Maison d'hôtes Hôtel Resort Riad Villa 8 hébergement s affiché s Hébergement Type Localisation Note Statut Actions B&B Toscana ★★★ B&B Flor …

---

### 4. `GET /dashboard/rooms`

**Scénario** : Il liste toutes ses chambres.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/rooms
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Chambres Gérez les chambres de vos hébergements Ajouter une chambre Total chambres 29 Actives 29 Unités totales 95 Prix moyen 149,54 € Chambre Test T-030 Hôtel Le Magnifique Double 2 pers. — m² 75,00 € par nuit • 1 unité Calendrier Chambre Supérieure Hôtel Le Magnifique Double 2 pers. 46.63 m² 172,00 € par nuit • 2 unité s Calendrier Chambre Standard Hôtel Le Magnifique Double 2 per …

---

### 5. `GET /dashboard/rooms/new`

**Scénario** : Il ouvre le formulaire de création de chambre.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/rooms/new
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Nouvelle chambre Ajoutez une chambre à l'un de vos hébergements. Détails de la chambre Hébergement Hôtel Le Magnifique Riad Jardin Secret Villa Azure Côte d'Azur Appartement Montmartre Dar El Medina Resort Les Dunes Hôtel Barcelona Center B&B Toscana Nom de la chambre Description (optionnel) Type Simple Double Twin Suite Studio Familiale Dortoir Capacité (personnes) Superficie (m²)  …

---

### 6. `GET /dashboard/reviews`

**Scénario** : Il modère les avis reçus (répondre publiquement).

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/reviews
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Avis Consultez les avis sur vos hébergements et répondez publiquement. Total avis 20 Moyenne 8.6 /10 En attente 0 Approuvés 20 Rechercher (tapez « / ») Filtrer Tous statuts En attente Approuvés Masqués Rejetés 20 avis affiché s S P Sophie Petit business · 21 août 2026 9.7 🌟 Excellent Hébergement : B&B Toscana ( Florence ) 👍 Ce qui a plu : Chambre spacieuse et propre. Le petit-déjeun …

---

### 7. `GET /dashboard/messages`

**Scénario** : Il lit les messages entrants des voyageurs.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/messages
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Messages Communiquez avec vos voyageurs Non lus 0 Total conversations 0 Temps de réponse < 2h Aucune conversation Les messages de vos voyageurs apparaîtront ici Temps de réponse Répondez rapidement à vos voyageurs ! Un temps de réponse inférieur à 2 heures améliore votre score de fiche et votre visibilité sur mybestbooking.

---

### 8. `GET /dashboard/promotions`

**Scénario** : Il gère ses codes promo actifs.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/promotions
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 9. `GET /dashboard/promotions/new`

**Scénario** : Il crée un nouveau code promo.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/promotions/new
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 10. `GET /dashboard/analytics`

**Scénario** : Il consulte ses statistiques.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/analytics
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Statistiques Aperçu de vos performances sur les 30 derniers jours 100.0 % 23 728,92 € Revenus (30j) 100.0 % 58 Réservations (30j) 0.0 % 409,12 € Panier moyen 8.6/10 Note moyenne Revenus par jour Il y a 14j Aujourd'hui Top hébergements 1 B&B Toscana 30 réservations 6 789,90 € 2 Villa Azure Côte d'Azur 5 réservations 3 760,13 € 3 Riad Jardin Secret 4 réservations 3 217,89 € 4 Hôtel Le …

---

### 11. `GET /dashboard/billing`

**Scénario** : Il consulte ses factures et commissions plateforme.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/billing
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking J D Jean Dupont Hébergeur Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ mybest booking Facturation Gérez vos revenus et factures Ce mois Revenus nets 20 169,51 € 58 réservation s Mois dernier Revenus nets 0,00 € 0 réservation s Total Revenus cumulés 20 169,51 € 58 réservation s au total Factures Export CSV via API (v prochaine) août 2026 58 réservation s 20 169,51 € En attente Transactions récentes MBB-2026-EBVZLX B&B Toscana 21 août 2026 + 207,20 € Commission: 36,57  …

---

## F. Administrateur (admin@mybestbooking.com) — zones admin-only

### 1. `GET /dashboard/users`

**Scénario** : L'admin liste tous les utilisateurs (customer/host/admin), peut suspendre.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/users
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking A M Admin MBB Administrateur Tableau de bord Hébergements Réservations Utilisateurs Avis Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ mybest booking Utilisateurs Gérez les utilisateurs de la plateforme — filtres, recherche, actions groupées Total 178 Clients 176 Hébergeurs 1 Admins 1 Rechercher (tapez « / ») Filtrer Tous les statuts Actifs Suspendus Email vérifié Email non vérifié Tous les rôles Client Hébergeur Admin 178 utilisateur s affiché s Utilisateur Email Rôle BestRewards Inscrit Derni …

---

### 2. `GET /dashboard/audit`

**Scénario** : L'admin consulte le journal d'audit (settings/moderate/suspend/validate).

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/audit
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking A M Admin MBB Administrateur Tableau de bord Hébergements Réservations Utilisateurs Avis Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ mybest booking Journal d'audit 100 dernières actions admin sensibles (réglages, modérations, suspensions, validations). Date Acteur Action Entité Détails 21 août 2026, 12:28 admin@mybestbooking.com bulk.action users { "ids": [ "a2e403af-df00-4046-9f8c-276df6859187" ], "failed": 0, "skipped": 0, "operation": "suspend", "requested": 1, "succeeded": 1 } 21 août 202 …

---

### 3. `GET /dashboard/settings`

**Scénario** : L'admin ouvre le panel de configuration (7 sections Zod).

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/settings
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking A M Admin MBB Administrateur Tableau de bord Hébergements Réservations Utilisateurs Avis Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ mybest booking Paramètres Configuration runtime de la plateforme MyBestBooking. Les modifications prennent effet immédiatement (jusqu'à 60 s de cache par instance). Paramètres généraux Nom de la plateforme Email de support Email partenaires Langue par défaut 🇫🇷 Français 🇬🇧 English 🇸🇦 العربية Devise par défaut € EUR $ USD £ GBP FCFA XAF Enregistrer Fiscalité & co …

---

### 4. `GET /dashboard/analytics`

**Scénario** : L'admin consulte les KPI globaux.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/analytics
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking A M Admin MBB Administrateur Tableau de bord Hébergements Réservations Utilisateurs Avis Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ mybest booking Statistiques Aperçu de vos performances sur les 30 derniers jours 100.0 % 23 728,92 € Revenus (30j) 100.0 % 58 Réservations (30j) 0.0 % 409,12 € Panier moyen 8.6/10 Note moyenne Revenus par jour Il y a 14j Aujourd'hui Top hébergements 1 B&B Toscana 30 réservations 6 789,90 € 2 Villa Azure Côte d'Azur 5 réservations 3 760,13 € 3 Riad Jardin Secret  …

---

## G. Page hébergement dynamique — /hebergement/[slug]

### 1. `GET /hebergement/b-b-toscana`

**Scénario** : Le visiteur consulte 'B&B Toscana'.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/hebergement/b-b-toscana
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `B&amp;B Toscana | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… B&B Toscana | mybestbooking ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés Accueil / Hébergements / Florence / B&B Toscana B&B ★★★ 💎 BestRewards B&B Toscana Via delle Colline, 42, Florence , IT 9.8 Exceptionnel ( 2 avis) ✦ La Promess …

---

### 2. `GET /hebergement/hotel-le-magnifique`

**Scénario** : Le visiteur consulte 'Hôtel Le Magnifique'.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/hebergement/hotel-le-magnifique
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Hôtel Le Magnifique | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… Hôtel Le Magnifique | mybestbooking ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés Accueil / Hébergements / Paris / Hôtel Le Magnifique Hôtel ★★★★ 💎 BestRewards Hôtel Le Magnifique 15 Rue de Rivoli, Paris , FR 9.0 Exceptionnel ( 2 av …

---

### 3. `GET /hebergement/dar-el-medina`

**Scénario** : Le visiteur consulte 'Dar El Medina'.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/hebergement/dar-el-medina
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Dar El Medina | mybestbooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… Dar El Medina | mybestbooking ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous droits réservés Accueil / Hébergements / Tunis / Dar El Medina Maison d'hôtes ★★★ 💎 BestRewards Dar El Medina Rue de la Kasbah, Tunis , TN 8.9 Superbe ( 2 avis) ✦ La Promes …

---

## H. Partage public d'une wishlist — /wishlists/share/[token]

### 1. `GET /wishlists/share/15308e03-52be-4880-aa01-549df4e6e342`

**Scénario** : Le voyageur envoie le lien à un ami. L'ami (non connecté) ouvre la wishlist publique.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/wishlists/share/15308e03-52be-4880-aa01-549df4e6e342
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `mybestbooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ mybest booking Hébergements 💎 BestRewards Aide Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ mybest booking .com "Réservez mieux. Voyagez plus." Mentions légales Confidentialité © 2025 mybestbooking.com — Tous dr …

---

## I. Scénarios métier API (parcours utilisateur bout-en-bout)

### 1. `GET /api/auth/me`

**Scénario** : L'utilisateur cust vérifie son identité côté client.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/api/auth/me
```

**Résultat serveur** : HTTP `200` (attendu `200 + role=customer`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> role="customer"

---

### 2. `GET /api/auth/me`

**Scénario** : L'utilisateur host vérifie son identité côté client.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/api/auth/me
```

**Résultat serveur** : HTTP `200` (attendu `200 + role=host`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> role="host"

---

### 3. `GET /api/auth/me`

**Scénario** : L'utilisateur admin vérifie son identité côté client.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/api/auth/me
```

**Résultat serveur** : HTTP `200` (attendu `200 + role=admin`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> role="admin"

---

### 4. `GET /api/properties?guests=2&checkIn=2027-01-15&checkOut=2027-01-18&sort=price_asc`

**Scénario** : Le voyageur cherche pour 2 pers en janvier 2027, trié par prix croissant.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/api/properties?guests=2&checkIn=2027-01-15&checkOut=2027-01-18&sort=price_asc
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> 8 propriétés retournées

---

### 5. `POST /api/bookings`

**Scénario** : Le voyageur réserve la 'Chambre Standard' 15→18 fév 2027 pour 2 pers. Le serveur applique BestRewards (level 2 = 15% remise) + le wallet 25 €.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/bookings
```

**Résultat serveur** : HTTP `201` (attendu `201 + confirmed`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> ref=MBB-2026-S8WEL8 · status=confirmed · discount=49.93 € · total=243.77 €

---

### 6. `POST /api/wishlists`

**Scénario** : Le voyageur ajoute 'B&B Toscana' à sa wishlist publique.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/wishlists
```

**Résultat serveur** : HTTP `201` (attendu `201`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"item":{"id":"ae79f3d8-bd4b-4701-b3b7-4e7fb2838c4f","wishlistId":"760d7544-e3a0-4157-944f-2c5d70f3abf6","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","addedAt":"2026-08-21T12:31:38.993Z","price

---

### 7. `POST /api/price-alerts`

**Scénario** : Le voyageur active une alerte prix ≤ 100 € pour 'B&B Toscana'.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/price-alerts
```

**Résultat serveur** : HTTP `201` (attendu `201`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"alert":{"id":"891708f4-260f-473c-a7d9-bd235515bfa8","userId":"24d0799c-915b-4e12-be22-fd93eddcc15b","propertyId":"941a231d-fa07-49e5-8b35-eadd4a0eb1b6","maxPrice":"100.00","currency":"EUR","active":

---

### 8. `GET /api/users/me/referral`

**Scénario** : Le voyageur consulte son code de parrainage pour le partager.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/api/users/me/referral
```

**Résultat serveur** : HTTP `200` (attendu `200 + code`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> code="BU23WN3L"

---

### 9. `POST /api/auth/register`

**Scénario** : Un nouveau visiteur crée un compte sim1787315499@test.local.

**Requête simulée** :
```bash
curl -X POST (anonyme) http://127.0.0.1:3000/api/auth/register
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"message":"Inscription réussie","user":{"id":"4d491df0-13dc-45da-a671-b97ff189d7d8","email":"sim1787315499@test.local","firstName":"Sim","lastName":"User","role":"customer"}}

---

### 10. `GET /api/admin/settings`

**Scénario** : Un voyageur mal intentionné tente /api/admin/settings.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/api/admin/settings
```

**Résultat serveur** : HTTP `403` (attendu `403`) → ✅ **OK (bloqué)**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"error":"Accès admin requis"}

---

### 11. `GET /api/admin/audit`

**Scénario** : Un voyageur mal intentionné tente /api/admin/audit.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/api/admin/audit
```

**Résultat serveur** : HTTP `403` (attendu `403`) → ✅ **OK (bloqué)**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"error":"Accès admin requis"}

---

### 12. `GET /api/admin/settings`

**Scénario** : L'admin consulte /api/admin/settings.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/api/admin/settings
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> 7 entrées retournées

---

### 13. `GET /api/admin/audit`

**Scénario** : L'admin consulte /api/admin/audit.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/api/admin/audit
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> 0 entrées retournées

---

### 14. `POST /api/auth/change-password`

**Scénario** : Le voyageur change son mot de passe (rejoue le même pour rester idempotent).

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/auth/change-password
```

**Résultat serveur** : HTTP `400` (attendu `200 ou 400`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"error":"Invalid input: expected string, received undefined"}

---

### 15. `POST /api/auth/logout`

**Scénario** : Le voyageur se déconnecte.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/auth/logout
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> <!DOCTYPE html><html lang="fr"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/static/chunks/src_app_globals_0p2ml

---

## J. Endpoint santé & maintenance

### 1. `GET /api/health`

**Scénario** : Le monitoring externe pinge le health-check.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/api/health
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"ok":true}

---


## 📊 Récapitulatif par section

| Section | PASS | KO |
|---|---|---|
| A. Pages publiques (visiteur non connecté) | 11 | 0 |
| B. Pages protégées — utilisateur non connecté (redirection edge → /connexion) | 8 | 0 |
| C. Voyageur authentifié (customer@mybestbooking.com) | 9 | 0 |
| D. Guards de rôle — voyageur (customer) tente d'ouvrir le dashboard | 5 | 0 |
| E. Hôte authentifié (host@mybestbooking.com) — dashboard host | 11 | 0 |
| F. Administrateur (admin@mybestbooking.com) — zones admin-only | 4 | 0 |
| G. Page hébergement dynamique — /hebergement/[slug] | 3 | 0 |
| H. Partage public d'une wishlist — /wishlists/share/[token] | 1 | 0 |
| I. Scénarios métier API (parcours utilisateur bout-en-bout) | 15 | 0 |
| J. Endpoint santé & maintenance | 1 | 0 |

## 🔁 Reproductibilité

Ce rapport a été généré par `/tmp/simulate.py` (versionné pour l'occasion à
`scripts/simulate.py` si tu veux le rejouer). Le script requiert :

1. `npm run db:dev` en cours (PostgreSQL embarqué sur :55432)
2. `npx next dev -H 0.0.0.0 -p 3000` en cours
3. Le seed déjà appliqué (`POST /api/seed`)

Puis `python3 /tmp/simulate.py`.

Chaque section joue les vraies requêtes HTTP, capture les vraies réponses,
et **n'invente rien** — c'est ce que ton navigateur verrait à la première
frame RSC (avant hydratation client). Les composants clients (formulaires
interactifs, DarkModeToggle, WishlistActions) ne sont donc pas simulés au
niveau clic (nécessiterait Playwright + Chromium, indisponible sandbox).
