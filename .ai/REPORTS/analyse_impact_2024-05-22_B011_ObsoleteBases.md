# Analyse d'Impact : B-011 (Gestion des Bases Obsolètes < v18)

**Niveau : S (Structurant)** — Modifie le flux de démarrage de l'application.

## 1. Appelants directs
- `AppDatabase.kt` : Doit détecter la version avant que Room ne tente les migrations.
- `SplashScreen.kt` : Doit intercepter l'erreur de migration ou le flag "obsolète" pour rediriger vers un écran de consentement.

## 2. Appelants indirects
- `MainViewModel.kt` : Gère le flag de configuration initiale.

## 3. ViewModels impactés
- `MainViewModel` : Doit exposer une fonction pour supprimer/réinitialiser la base obsolète.

## 4. Écrans impactés
- `SplashScreen` : Redirection.
- `ConsentScreen` (Nouveau) ou Dialogue sur `Splash` : Pour obtenir l'accord de l'utilisateur.

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- Aucun test couvrant les versions < 18.

## 7. Nouveaux tests requis
- Difficile à tester sans un fichier `.db` de version 1-17. Validation manuelle par simulation de code requise.

## 8. Risques de régression
- **R1 (Faux Positif)** : Détecter une base saine comme obsolète.
- **R2 (UX)** : Bloquer l'utilisateur sur le Splash en cas d'erreur non gérée.

## 9. Liste de revérification
- [ ] Vérifier que `PRAGMA user_version` est lu correctement avant l'init de Room.
- [ ] Vérifier que le bouton de recréation fonctionne (suppression physique des fichiers).

## Commandes exécutées
N/A
