# Analyse d'Impact : B-090 (Tests unitaires SmsParser)

**Niveau : L (Local)** — Ajout de tests unitaires pour le moteur de parsing SMS.

## 1. Appelants directs
- `com.reconsiliation.caisse.sms.SmsParser` : Objet testé.
- `SmsReceiver.kt` : Utilise `SmsParser`.
- `MainRepository.kt` : Utilise `SmsParser` pour la résolution des erreurs MoMo.

## 2. Appelants indirects
- Aucun.

## 3. ViewModels impactés
- Aucun.

## 4. Écrans impactés
- Aucun (fiabilisation invisible en UI).

## 5. Workers / Services impactés
- `SmsReceiver` : Bénéficiera de la garantie de non-régression sur le parsing.

## 6. Tests existants
- Aucun test ne couvre `SmsParser`.

## 7. Nouveaux tests requis
- `SmsParserTest.kt` (Unit Test JVM) :
    - [ ] Parsing MTN MoMo standard.
    - [ ] Parsing Orange Money standard.
    - [ ] Détection d'abonnement (numéro dev).
    - [ ] Rejet de messages non financiers.
    - [ ] Gestion du flag `isSecure` (Anti-fraude).

## 8. Risques de régression
- Aucun. Les tests sont en lecture seule pour le code de production.

## 9. Liste de revérification
- [ ] Vérifier que les SMS MTN et Orange réels du Cameroun sont correctement parsés.

## Commandes exécutées
```bash
grep -rn "SmsParser" app/src
```
