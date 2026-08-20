# Analyse d'Impact : B-028 (Augmentation des itérations PBKDF2)

**Niveau : S (Structurant)** — Impacte la sécurité des comptes utilisateurs et le processus de connexion.

## 1. Appelants directs
- `SecurityUtil.kt` : Fonctions `hashPinPbkdf2` et `verifyPin`.
- `MainViewModel.kt` : Fonction `checkPin`.
- `MainRepository.kt` : Fonction `saveStaff`.

## 2. Appelants indirects
- Écran de connexion (PIN Dialog).
- Écran de gestion du personnel.

## 3. ViewModels impactés
- `MainViewModel` : Logique de migration paresseuse.

## 4. Écrans impactés
- Tous les écrans exigeant un PIN (Navigation protégée).

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- Aucun test unitaire sur la migration des PIN.

## 7. Nouveaux tests requis
- `SecurityUtilTest.kt` : 
    - [ ] Vérifier la rétrocompatibilité avec les hashs à 5000 itérations.
    - [ ] Vérifier que les nouveaux hashs utilisent 100 000 itérations.

## 8. Risques de régression
- **R1 (Lockout)** : Si la migration échoue ou si l'ancien format n'est plus reconnu, personne ne pourra plus se connecter.
- **R2 (Performance)** : 100 000 itérations peuvent prendre ~200-500ms sur des téléphones lents.

## 9. Liste de revérification
- [ ] Supporter le format `base64(salt):iterations` dans la colonne `pinSalt`.
- [ ] Maintenir la compatibilité avec le format `base64(salt)` simple (supposé 5000).

## Commandes exécutées
N/A
