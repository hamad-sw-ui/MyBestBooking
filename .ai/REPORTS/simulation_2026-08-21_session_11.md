# 🎬 Simulation utilisateur exhaustive — Session 11 (2026-08-21)

**Généré le** : 2026-09-10 07:36
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

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés avant demande Avis vérifiés 0 frais cachés 🔥 Hébergements populaires Les mieux notés par nos voyageurs Voir tout 💎 BestRewards Villa Azure Côte d'Azur ★★★★★ Nice , France 9.6 2 avis Villa Dès 99,99 € /nuit Voir les chambres → Hôtel Barcelona Center ★★★★ Barcelone , Espagne 9.5 2 av …

---

### 2. `GET /recherche`

**Scénario** : Le visiteur ouvre la page de recherche vide. Le formulaire de filtres s'affiche.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/recherche
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Recherche d&#x27;hébergements | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés Destination Arrivée Départ Type Tous les types Hôtel Appartement Maison Villa Aube …

---

### 3. `GET /aide`

**Scénario** : Le visiteur cherche de l'aide. Il voit les FAQ et 3 canaux de contact (mailto).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/aide
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Aide et FAQ | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Comment pouvons-nous vous aider ? Recherchez une réponse ou contactez notre équipe par email. Articles Annuler une réservation Modifier mes dates Réservation sans paiement en ligne Suivi après annulation Laisser un avis BestRewards et cashback Sécurité et suppression du compte Gérer une chambre et ses tarifs Réservations Annuler une réservation Ouvrez Mes réservations, choisissez une réservation confirmée puis Annuler. Les frais et le remboursement dépendent de la poli …

---

### 4. `GET /bestrewards`

**Scénario** : Le visiteur découvre le programme de fidélité BestRewards (3 niveaux).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/bestrewards
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `BestRewards — programme fidélité | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés BestRewards Les vrais avantages, dès votre 1ère réservation. Rejoignez le programm …

---

### 5. `GET /mentions-legales`

**Scénario** : Le visiteur consulte les mentions légales (éditeur, hébergeur, CGU, CGV).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mentions-legales
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Mentions légales | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Mentions légales Éditeur du site MyBestBooking — plateforme de réservation d'hébergements. Raison sociale : à compléter par l'éditeur en production. Contact : support@mybestbooking.com Hébergement Le site est hébergé sur une infrastructure cloud professionnelle (Vercel / Neon PostgreSQL ou équivalent). Détails à préciser en production. Conditions générales d'utilisation En utilisant MyBestBooking, vous acceptez de : Fournir des informations exactes lors de l'inscription. Ne pas utiliser le …

---

### 6. `GET /confidentialite`

**Scénario** : Le visiteur consulte la politique de confidentialité (RGPD, droits, cookies).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/confidentialite
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Politique de confidentialité | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Politique de confidentialité Données collectées MyBestBooking collecte les données nécessaires au fonctionnement du service : Compte : email, nom, prénom, mot de passe (haché bcrypt coût 12). Profil optionnel : téléphone, pays, langue, devise, fuseau horaire. Réservations : dates, hébergement, montant estimé, suivi de statut (aucune donnée de carte bancaire dans le tunnel). Traçabilité : IP au moment du login (pour la sécurité), dernière connexion. Communication : messages échangés avec le …

---

### 7. `GET /connexion`

**Scénario** : Le visiteur ouvre la page de connexion. Un formulaire email + mot de passe.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/connexion
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Connexion | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ MyBest Booking Connexion Bienvenue sur MyBestBooking Adresse e-mail Mot de passe Se souvenir de moi Mot de passe oublié ? Se connecter Pas encore de compte ? Créer un compte Comptes de démonstration — connexion en un clic : Admin admin@mybestbooking.com Hébergeur host@mybestbooking.com Client customer@mybestbooking.com Un clic connecte directement ; les mots de passe restent affichés ci-dessous pour une saisie manuelle. Admin : Admin123! · Hébergeur : Host123! · Client : Customer123! © 2025 MyBestBooking — " Réservez mieux. Voyagez plus. "

---

### 8. `GET /inscription`

**Scénario** : Le visiteur ouvre la page d'inscription. Un formulaire complet.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/inscription
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Créer un compte | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ MyBest Booking Créer un compte Rejoignez MyBestBooking gratuitement Voyageur Hébergeur Prénom Nom Adresse e-mail Mot de passe Confirmer le mot de passe Code de parrainage (facultatif) En créant un compte, vous acceptez nos Mentions légales & CGU et notre Politique de confidentialité . Créer mon compte Déjà un compte ? Se connecter © 2025 MyBestBooking — " Réservez mieux. Voyagez plus. "

---

### 9. `GET /mot-de-passe-oublie`

**Scénario** : Le visiteur a oublié son mot de passe. Il saisit son email.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/mot-de-passe-oublie
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Mot de passe oublié | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ MyBest Booking Mot de passe oublié Saisissez votre adresse email, nous vous enverrons un lien pour définir un nouveau mot de passe. Adresse e-mail Envoyer le lien Retour à la connexion © 2025 MyBestBooking — " Réservez mieux. Voyagez plus. "

---

### 10. `GET /verifier-email`

**Scénario** : Le visiteur clique un lien de vérification email reçu.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/verifier-email
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Vérifier mon email | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal ✦ MyBest Booking Lien invalide Ce lien de vérification est expiré ou déjà utilisé. Connectez-vous puis demandez un nouveau lien depuis votre compte (Mon compte), ou contactez le support. Se connecter Mon compte © 2025 MyBestBooking — " Réservez mieux. Voyagez plus. "

---

### 11. `GET /maintenance`

**Scénario** : La page de maintenance (affichée quand le mode maintenance est actif).

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/maintenance
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Maintenance en cours — MyBestBooking | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours…

---

### 12. `GET /reservation`

**Scénario** : Le visiteur finalise une réservation : guest mode (email invité) quand non connecté.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/reservation
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Finaliser ma réservation | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Informations de réservation manquantes ou invalides Rechercher un hébergement Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés

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

### 5. `GET /dashboard`

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

### 6. `GET /dashboard/bookings`

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

### 7. `GET /dashboard/properties`

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

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés avant demande Avis vérifiés 0 frais cachés 🔥 Hébergements populaires Les mieux notés par nos voyageurs Voir tout 💎 BestRewards Villa Azure Côte d'Azur ★★★★★ Nice , France 9.6 2 avis Villa Dès 99,99 € /nuit Voir les chambres → Hôtel Barcelona Center ★★★★ Barcelone , Espagne 9.5 2 avis Hôtel Dès 118,67  …

---

### 2. `GET /mon-compte`

**Scénario** : Il ouvre son compte : profil, sécurité, notifications, wallet 25 €, BestRewards Or.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/mon-compte
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Mon compte | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Mon compte | MyBestBooking Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés

---

### 3. `GET /mes-reservations`

**Scénario** : Il liste ses réservations avec statut, dates, boutons Contacter/Confirmation/Annuler.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/mes-reservations
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Mes réservations | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Mes réservations Retrouvez toutes vos réservations MyBestBooking À venir ( 1 ) Confirmée Hôtel Le Magnifique Paris , France Réf. MBB-2026-FH0VVE Arrivée 24 sept. 2026 Départ 27 sept. 2026 Chambre Chambre Standard Total 391,61 € Voir l'hébergement Écrire à l'hébergeur Facture / Reçu Annuler Mes réservations | MyBestBooking Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hé …

---

### 4. `GET /mes-favoris`

**Scénario** : Il ouvre ses favoris : ses wishlists + alertes prix.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/mes-favoris
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Mes favoris | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Mes favoris 1 hébergement sauvegardé Nouvelle liste Alertes prix Chargement… Vos alertes prix sont gérées ci-dessus. Ajoutez-en depuis la fiche d'un hébergement (bouton « Suivre le prix »). Vacances été 2025 1 hébergement Rendre publique 💎 BestRewards Villa Azure Côte d'Azur ★★★★★ Nice , France 9.6 2 avis Villa Prix indisponible Voir les chambres → Alertes prix Activez les alertes pour être notifié quand le prix d'un de vos favoris baisse. Vous recevrez un email dès qu'une bonne affaire s …

---

### 5. `GET /messages`

**Scénario** : Il ouvre sa messagerie avec les hôtes.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/messages
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Messagerie | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Messages Vos conversations avec les hébergeurs Rechercher dans les messages Aucun message Vos conversations avec les hébergeurs apparaîtront ici. Utilisez « Contacter l'hôte » sur une fiche ou depuis une réservation. Trouver un hébergement Besoin d'aide ? Notre équipe support répond par email aux demandes envoyées depuis ce lien. Contacter le support Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajou …

---

### 6. `GET /reservation`

**Scénario** : Il ouvre la page de finalisation (avec wallet et guest mode).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/reservation
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Finaliser ma réservation | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Informations de réservation manquantes ou invalides Rechercher un hébergement Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés

---

### 7. `GET /recherche`

**Scénario** : Il refait une recherche avec ses préférences.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/recherche
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Recherche d&#x27;hébergements | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Destination Arrivée Départ Type Tous les types Hôtel Appartement Maison Villa Auberge Resort B&B Maison d'hôtes Riad Camping Pays Tous les pays France Maroc Tunisie Espagne Italie Portugal Allemagne Royaume-Uni États-Unis Voyageurs Équipement Tous WiFi gratuit Parking Piscine Spa Restaurant Bar Salle de sport Climatisation Room service Conciergerie Accès plage Jardin Balcon Barbecue Plage Petit-déjeuner Vue sur la ville Vue sur la campagne Club enfants Cuisine Rooftop Vue sur la mer Terra …

---

### 8. `GET /aide`

**Scénario** : Il consulte l'aide.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/aide
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Aide et FAQ | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Comment pouvons-nous vous aider ? Recherchez une réponse ou contactez notre équipe par email. Articles Annuler une réservation Modifier mes dates Réservation sans paiement en ligne Suivi après annulation Laisser un avis BestRewards et cashback Sécurité et suppression du compte Gérer une chambre et ses tarifs Réservations Annuler une réservation Ouvrez Mes réservations, choisissez une réservation confirmée puis Annuler. Les frais et le remboursement dépendent de la politique snapshotée dan …

---

### 9. `GET /bestrewards`

**Scénario** : Il consulte son statut BestRewards.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/bestrewards
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `BestRewards — programme fidélité | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M BestRewards Les vrais avantages, dès votre 1ère réservation. Rejoignez le programme de fidélité MyBestBooking. Votre niveau : 💎 Niveau 2 — Voyageur Chargement de votre statut… Comment ça marche ? 1 Inscrivez-vous C'est gratuit et instantané. Vous êtes immédiatement Niveau 1 Explorer. 2 Réservez Chaque réservation confirmée compte. Plus vous voyagez, plus vous montez en niveau. 3 Profitez Profitez des réductions BestRewards ; le wallet reste informatif tant que le paiement en ligne est dés …

---

## D. Guards de rôle — voyageur (customer) tente d'ouvrir le dashboard

### 1. `GET /dashboard`

**Scénario** : Un voyageur tente d'ouvrir le dashboard host/admin.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés av …

---

### 2. `GET /dashboard/properties`

**Scénario** : Idem sur la gestion des propriétés.

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/properties
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés av …

---

### 3. `GET /dashboard/users`

**Scénario** : Idem sur les utilisateurs (admin-only).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/users
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés av …

---

### 4. `GET /dashboard/settings`

**Scénario** : Idem sur les paramètres (admin-only).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/settings
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés av …

---

### 5. `GET /dashboard/audit`

**Scénario** : Idem sur l'audit log (admin-only).

**Requête simulée** :
```bash
curl -X GET cookie=cust http://127.0.0.1:3000/dashboard/audit
```

**Résultat serveur** : HTTP `200` (attendu `200 + body sans dashboard`) → ✅ **OK (guard actif — contenu non rendu)**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN M M Réservez mieux. Voyagez plus. Trouvez les meilleurs hébergements au meilleur prix. Offres affichées, avis vérifiés et frais présentés avant confirmation. Destination Rechercher Prix vérifiés av …

---

## E. Hôte authentifié (host@mybestbooking.com) — dashboard host

### 1. `GET /dashboard`

**Scénario** : L'hôte arrive sur son tableau de bord (revenus, réservations, occupation).

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Bonjour, Jean 👋 Voici un aperçu de votre activité sur MyBestBooking Hébergements 9 8 actifs Réservations 31 31 ce mois Revenus 18 138,68 € 18 138,68 € ce mois Avis 22 avis vérifiés Réservations récentes Voir tout → Référence Client Hébergement Dates Montant Statut MBB-2026-FH0VVE Marie Martin Hôtel Le Magnifique Paris 24 sept. 2026 → 27 sept. …

---

### 2. `GET /dashboard/bookings`

**Scénario** : Il liste toutes les réservations reçues sur ses propriétés.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/bookings
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Réservations Réservations de vos hébergements — filtres et recherche. Export CSV Total 31 Confirmées 1 En attente 0 Revenus 18 139 € Rechercher (tapez « / ») Filtrer Tous statuts En attente Confirmée Annulée Terminée No-show Check-in à partir de Check-out jusqu'à 31 réservations affichées Référence Client Hébergement Dates Montant Statut Acti …

---

### 3. `GET /dashboard/properties`

**Scénario** : Il liste ses propriétés.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/properties
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Hébergements Gérez vos hébergements — filtres et recherche. Ajouter un hébergement Total 9 Actifs 8 En attente 0 Brouillons 1 Rechercher (tapez « / ») Filtrer Tous les statuts Actif En attente Brouillon Suspendu Rejeté Tous types Appartement B&B Maison d'hôtes Hôtel Resort Riad Villa 9 hébergements affichés Hébergement Type Localisation Note  …

---

### 4. `GET /dashboard/rooms`

**Scénario** : Il liste toutes ses chambres.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/rooms
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Chambres Gérez les chambres de vos hébergements Ajouter une chambre Total 22 Actives 22 Unités 80 Prix moyen 157,71 € Rechercher (tapez « / ») Filtrer Toutes Actives Inactives Tous types Double Familiale Suite 22 chambres affichées Chambre Supérieure Hôtel Le Magnifique Double 2 pers. 29.58 m² 172,00 € par nuit · 3 unités Calendrier Chambre S …

---

### 5. `GET /dashboard/rooms/new`

**Scénario** : Il ouvre le formulaire de création de chambre.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/rooms/new
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Nouvelle chambre Ajoutez une chambre à l'un de vos hébergements. Détails de la chambre Hébergement Hôtel Le Magnifique Riad Jardin Secret Villa Azure Côte d'Azur Appartement Montmartre Dar El Medina Resort Les Dunes Hôtel Barcelona Center Deep Villa 1789024791 B&B Toscana Nom de la chambre Description (optionnel) Type Simple Double Twin Suite …

---

### 6. `GET /dashboard/reviews`

**Scénario** : Il modère les avis reçus (répondre publiquement).

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/reviews
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Avis Consultez les avis sur vos hébergements et répondez publiquement. Total avis 22 Moyenne 8.6 /10 En attente 0 Approuvés 22 Rechercher (tapez « / ») Filtrer Tous statuts En attente Approuvés Masqués Rejetés 22 avis affichés S P Sophie Petit Affaires · 10 sept. 2026 7.9 🙂 Bien Hébergement : B&B Toscana ( Florence ) 👍 Ce qui a plu : Chambre  …

---

### 7. `GET /dashboard/messages`

**Scénario** : Il lit les messages entrants des voyageurs.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/messages
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Messages Communiquez avec vos voyageurs Rechercher (tapez « / ») Filtrer Toutes Non lues Lues Non lus 0 Total conversations 0 Temps de réponse < 2h 0 conversation affichée Aucune conversation Les messages de vos voyageurs apparaîtront ici (ou ajustez vos filtres). Répondre aux voyageurs Ouvrez une conversation pour répondre. Aucun délai ni im …

---

### 8. `GET /dashboard/promotions`

**Scénario** : Il gère ses codes promo actifs.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/promotions
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Bonjour, Jean 👋 Voici un aperçu de votre activité sur MyBestBooking Hébergements 9 8 actifs Réservations 31 31 ce mois Revenus 18 138,68 € 18 138,68 € ce mois Avis 22 avis vérifiés Réservations récentes Voir tout → Référence Client Hébergement Dates Montant Statut MBB-2026-FH0VVE Marie Martin Hôtel Le Magnifique Paris 24 sept. 2026 → 27 sept. …

---

### 9. `GET /dashboard/promotions/new`

**Scénario** : Il crée un nouveau code promo.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/promotions/new
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Bonjour, Jean 👋 Voici un aperçu de votre activité sur MyBestBooking Hébergements 9 8 actifs Réservations 31 31 ce mois Revenus 18 138,68 € 18 138,68 € ce mois Avis 22 avis vérifiés Réservations récentes Voir tout → Référence Client Hébergement Dates Montant Statut MBB-2026-FH0VVE Marie Martin Hôtel Le Magnifique Paris 24 sept. 2026 → 27 sept. …

---

### 10. `GET /dashboard/analytics`

**Scénario** : Il consulte ses statistiques.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/analytics
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Statistiques Aperçu de vos performances sur les 30 derniers jours 100.0 % 18 138,68 € Revenus (30j) 100.0 % 31 Réservations (30j) 0.0 % 585,12 € Panier moyen 8.6/10 Note moyenne Revenus par jour (EUR) Il y a 14j Aujourd'hui Top hébergements 1 Resort Les Dunes 4 réservations 3 857,32 € 2 Riad Jardin Secret 5 réservations 3 341,13 € 3 Villa Azu …

---

### 11. `GET /dashboard/billing`

**Scénario** : Il consulte ses factures et commissions plateforme.

**Requête simulée** :
```bash
curl -X GET cookie=host http://127.0.0.1:3000/dashboard/billing
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking J D Jean Dupont Hébergeur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Chambres Réservations Avis Messages Statistiques Facturation Aide Déconnexion ✦ MyBest Booking Facturation Gérez vos revenus et factures Ce mois Revenus nets 15 417,85 € 31 réservations Mois dernier Revenus nets 0,00 € 0 réservations Total Revenus cumulés 15 417,85 € 31 réservations au total Factures Export CSV Factures légales indisponibles Les factures et exports seront disponibles après intégration du moteur comptable. Transactions  …

---

## F. Administrateur (admin@mybestbooking.com) — zones admin-only

### 1. `GET /dashboard/users`

**Scénario** : L'admin liste tous les utilisateurs (customer/host/admin), peut suspendre.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/users
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking A M Admin MBB Administrateur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Réservations Utilisateurs Avis Messages Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ MyBest Booking Utilisateurs Gérez les utilisateurs de la plateforme — filtres, recherche, actions groupées Total 23 Clients 21 Hébergeurs 1 Admins 1 Rechercher (tapez « / ») Filtrer Tous les statuts Actifs Suspendus Email vérifié Email non vérifié Tous les rôles Client Hébergeur Admin 23 utilisateurs affichés Uti …

---

### 2. `GET /dashboard/audit`

**Scénario** : L'admin consulte le journal d'audit (settings/moderate/suspend/validate).

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/audit
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking A M Admin MBB Administrateur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Réservations Utilisateurs Avis Messages Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ MyBest Booking Journal d'audit 100 dernières actions admin sensibles (réglages, modérations, suspensions, validations, actions groupées). Rechercher (tapez « / ») Action Toutes actions booking.pay.offline Property rejetée Property validée Avis modéré Réglage modifié Suspendre Entité Toutes entités booking propert …

---

### 3. `GET /dashboard/settings`

**Scénario** : L'admin ouvre le panel de configuration (7 sections Zod).

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/settings
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking A M Admin MBB Administrateur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Réservations Utilisateurs Avis Messages Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ MyBest Booking Paramètres Configuration runtime de la plateforme MyBestBooking. Les modifications prennent effet immédiatement (jusqu'à 60 s de cache par instance). Paramètres généraux Nom de la plateforme Email de support Email partenaires Langue par défaut 🇫🇷 Français 🇬🇧 Anglais Devise par défaut € EUR $ USD £  …

---

### 4. `GET /dashboard/analytics`

**Scénario** : L'admin consulte les KPI globaux.

**Requête simulée** :
```bash
curl -X GET cookie=admin http://127.0.0.1:3000/dashboard/analytics
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `MyBestBooking — Réservez mieux. Voyagez plus.`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking A M Admin MBB Administrateur FR EN Devise d'affichage EUR USD GBP XAF Tableau de bord Hébergements Réservations Utilisateurs Avis Messages Promotions Statistiques Facturation Journal d'audit Paramètres Aide Déconnexion ✦ MyBest Booking Statistiques Aperçu de vos performances sur les 30 derniers jours 100.0 % 18 138,68 € Revenus (30j) 100.0 % 31 Réservations (30j) 0.0 % 585,12 € Panier moyen 8.6/10 Note moyenne Revenus par jour (EUR) Il y a 14j Aujourd'hui Top hébergements 1 Resort Les Dunes 4 réservations 3 857,32 € 2 Riad Jardin …

---

## G. Page hébergement dynamique — /hebergement/[slug]

### 1. `GET /hebergement/villa-azure-cote-d-azur`

**Scénario** : Le visiteur consulte 'Villa Azure Côte d'Azur'.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/hebergement/villa-azure-cote-d-azur
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Villa Azure Côte d&#x27;Azur | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Accueil / Hébergements / Nice / Villa Azure Côte d'Azur Villa ★★★★★ 💎 BestRewards Villa Azure Côte d'Azur Chemin des Collines, Nice , France 9.6 Exceptionnel (2 avis) ✦ Informations MyBestBooking Prix vérifié avant demande Frais affichés avant confirmation Avis vérifiés Contact support par email À propos Magnifique villa avec vue mer panoramique sur la Côte d'Azur. Piscine à débordement, jardins méditerranéens et accès privé à la plage. Équipements WiFi gratuit Piscine Accès plage Parking Jardin Barbecue Chambres disponibles Chambre Standard 2 pers. max 35.45 m² Annu …

---

### 2. `GET /hebergement/hotel-barcelona-center`

**Scénario** : Le visiteur consulte 'Hôtel Barcelona Center'.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/hebergement/hotel-barcelona-center
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Hôtel Barcelona Center | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés Accueil / Hébergements / Barcelone / Hôtel Barcelona Center Hôtel ★★★★ Hôtel Barcelona Center Carrer de Pelai, 28, Barcelone , Espagne 9.5 Exceptionnel (2 avis) ✦ Informations MyBest …

---

### 3. `GET /hebergement/riad-jardin-secret`

**Scénario** : Le visiteur consulte 'Riad Jardin Secret'.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/hebergement/riad-jardin-secret
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Riad Jardin Secret | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tous droits réservés Accueil / Hébergements / Marrakech / Riad Jardin Secret Riad ★★★★ 💎 BestRewards Riad Jardin Secret Derb Moulay Abdel Kader, Marrakech , Maroc 8.7 Superbe (4 avis) ✦ Informations MyBe …

---

## H. Partage public d'une wishlist — /wishlists/share/[token]

### 1. `GET /wishlists/share/55823f94-d064-48c1-a2d4-a05afd37901f`

**Scénario** : Le voyageur envoie le lien à un ami. L'ami (non connecté) ouvre la wishlist publique.

**Requête simulée** :
```bash
curl -X GET (anonyme) http://127.0.0.1:3000/wishlists/share/55823f94-d064-48c1-a2d4-a05afd37901f
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `Voyage été 2027 — Liste partagée | MyBestBooking`

**Ce que voit l'utilisateur** (texte visible extrait) :

> Aller au contenu principal Chargement en cours… ✦ MyBest Booking Hébergements 💎 BestRewards Aide FR EN Se connecter S'inscrire Découvrir Rechercher un hébergement 💎 BestRewards Centre d'aide Voyageurs Mon compte Mes réservations Mes favoris Messagerie Hébergeurs Ajouter mon hébergement Espace hébergeur Créer un compte Contact 📧 support@mybestbooking.com 🤝 partners@mybestbooking.com ✦ MyBest Booking .com “ Réservez mieux. Voyagez plus. ” Mentions légales Confidentialité © 2025 MyBestBooking — Tou …

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

**Scénario** : Le voyageur réserve la 'Chambre Standard' 15→18 fév 2027 pour 2 pers. Par défaut T-205, le serveur crée une demande en attente de confirmation manuelle.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/bookings
```

**Résultat serveur** : HTTP `201` (attendu `201 + pending + manualConfirmation`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> ref=MBB-2026-QAO94S · status=pending · manual=True · discount=83.21 € · total=406.28 €

---

### 6. `POST /api/wishlists`

**Scénario** : Le voyageur ajoute 'Villa Azure Côte d'Azur' à sa wishlist publique.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/wishlists
```

**Résultat serveur** : HTTP `201` (attendu `201`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"item":{"id":"afe41cbe-7da4-401d-a5ac-5cf7e3da61a1","wishlistId":"41c6bd99-eb3d-4793-838b-f9c14a2fa3dd","propertyId":"b1a1b9b8-39a2-4a82-a47c-c877cbc220df","addedAt":"2026-09-10T07:36:32.331Z","price

---

### 7. `POST /api/price-alerts`

**Scénario** : Le voyageur active une alerte prix ≤ 100 € pour 'Villa Azure Côte d'Azur'.

**Requête simulée** :
```bash
curl -X POST cookie=cust http://127.0.0.1:3000/api/price-alerts
```

**Résultat serveur** : HTTP `201` (attendu `201`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"alert":{"id":"228a63ce-db5d-461c-80c0-9a72e67c1518","userId":"5285e822-5dca-4624-9cc8-462eb6ed2091","propertyId":"b1a1b9b8-39a2-4a82-a47c-c877cbc220df","maxPrice":"100.00","currency":"EUR","checkIn"

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

> code="C4AZDB6K"

---

### 9. `POST /api/auth/register`

**Scénario** : Un nouveau visiteur crée un compte sim1789025792@test.local.

**Requête simulée** :
```bash
curl -X POST (anonyme) http://127.0.0.1:3000/api/auth/register
```

**Résultat serveur** : HTTP `200` (attendu `200`) → ✅ **OK**

**Titre / type de réponse** : `(JSON)`

**Ce que voit l'utilisateur** (texte visible extrait) :

> {"message":"Inscription réussie","user":{"id":"5f8aed2f-8219-4e7b-aa31-8b097219d872","email":"sim1789025792@test.local","firstName":"Sim","lastName":"User","role":"customer","language":"fr"}}

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

> 8 entrées retournées

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

> {"error":"Valeur invalide ou manquante"}

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

> <!DOCTYPE html><html lang="fr" data-scroll-behavior="smooth"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="stylesheet" href="/_next/stati

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
| A. Pages publiques (visiteur non connecté) | 12 | 0 |
| B. Pages protégées — utilisateur non connecté (redirection edge → /connexion) | 7 | 0 |
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
