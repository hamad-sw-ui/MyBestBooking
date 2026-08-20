# Analyse d'Impact : B-023 (Retrait du générateur de licence)

**Niveau : S (Structurant)** — Impacte la monétisation et l'activation de l'application.

## 1. Appelants directs
- `LicenseUtil.kt` : Fonction `generateActivationKey`.
- `MainRepository.kt` : Fonction `processSubscriptionSms` (Auto-activation).

## 2. Appelants indirects
- Aucun (fonction admin uniquement).

## 3. ViewModels impactés
- Aucun.

## 4. Écrans impactés
- Aucun directement, mais l'auto-activation après paiement MoMo ne fonctionnera plus.

## 5. Workers / Services impactés
- Aucun.

## 6. Tests existants
- Aucun.

## 7. Nouveaux tests requis
- Aucun.

## 8. Risques de régression
- **R1 (Business)** : Perte de la fonctionnalité d'activation automatique. L'utilisateur devra saisir manuellement une clé reçue par un autre canal (WhatsApp, SMS manuel de l'admin).

## 9. Liste de revérification
- [ ] Supprimer `generateActivationKey` de `LicenseUtil.kt`.
- [ ] Commenter ou supprimer la logique d'auto-activation dans `MainRepository.kt`.

## Commandes exécutées
```bash
grep -rn "generateActivationKey" app/src
```
