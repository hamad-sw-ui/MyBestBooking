# Validation — T-262 (audit n°6, B8 : crédit gelé à la suppression de compte)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : constat **B8** — « Suppression de compte : un crédit gelé qui disparaît en
  silence ». **Sous gel wallet T-248 §3 : aucune consommation, aucune mutation du solde.**
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.8

## 1. Livré

| Élément | Changement |
|---|---|
| Journal | `wallet_transactions` reçoit une ligne `kind='account_closed'`, `amount='0.00'`, `balanceAfter=<solde>` **dans la transaction** de suppression, uniquement si le solde > 0 |
| Solde | **Inchangé** (gel respecté) ; aucune déduction, aucun versement, aucun blocage |
| Écran | Zone de danger (`/mon-compte`) : encart ambre « Votre crédit accumulé de X sera perdu… » quand le solde est positif, masqué sinon |
| i18n | +1 clé FR/EN (`account.deleteWalletWarning`), verrou **1748 → 1749** |
| Garde-fou | `wallet-policy.test.ts` vérifie que la route appelle `recordAccountClosureEntry` et que l'écrivain écrit `amount: "0.00"` |

## 2. Preuves automatisées

- `src/app/api/users/me/route.t262.test.ts` **2/2** (base réelle) : compte à `12.50` → 200,
  anonymisation intacte (`deleted-…@anonymized.local`, `deletedAt` posé), **une** ligne
  `account_closed` `0.00` / `12.50`, solde toujours `12.50` ; compte à `0.00` → 200, **aucune**
  ligne, solde `0.00`.
- `src/components/delete-account-section.test.tsx` **2/2** : le montant est rendu (« 12,50 »,
  « sera perdu », « crédit futur ») ; rien n'est rendu pour `0.00` ou sans prop.
- `src/lib/wallet-ledger.test.ts` **5/5** (journal inchangé), `src/lib/wallet-policy.test.ts`
  **3/3** (gel préservé), `src/lib/ui-strings.test.ts` **7/7** (parité FR/EN, verrou 1749).
- `npx tsc --noEmit` 0 · `npx eslint src --max-warnings 0` 0/0.

## 3. Sonde runtime (serveur réel, base démo)

| Étape | Résultat |
|---|---|
| Client jetable créé avec `wallet_balance = 12.50` (script one-shot) puis connexion | 200 |
| `GET /api/auth/me` avec la session | `walletBalance` exposé (l'écran client peut afficher le montant) |
| `DELETE /api/users/me` | **200** `{"deleted":true}` |
| Base | `users` : `deleted-1614ccca23f52f84@anonymized.local`, `deleted_at` posé, `wallet_balance = 12.50` **inchangé** ; `wallet_transactions` : 1 ligne `account_closed`, `0.00`, `balance_after 12.50` |
| Ménage | ligne + compte jetable supprimés — base revenue à l'état seed |

## 4. Note de conception

Le solde n'est **pas** remboursé et ne peut pas l'être dans le cadre du gel (décision produit
T-248 §3). L'avertissement évite la surprise ; la ligne de journal rend l'état explicable a
posteriori. Le fait de refuser la suppression tant que le solde est > 0 a été examiné puis écarté
(il bloquerait un droit RGPD).

## 5. Fragilité corrigée au passage (hors périmètre B8)

La suite complète a d'abord échoué sur `reviews-page.t258.test.ts` (2 tests) : le test codait
« 2 avis déjà présents » et plaçait ses avis d'essai plus récents que ceux du seed — deux hypothèses
fausses face au **seed aléatoire** (`Math.random()` dans `api/seed`, 2 à 4 avis par bien) et à un
seed régénéré moins de 22 minutes plus tôt. Correction (test uniquement, aucun code produit
touché) : total attendu **calculé** (`count()` des avis approuvés) et avis d'essai ancrés une seconde
d'écart au-dessus du plus récent avis existant. Suite complète après correction : **144 fichiers /
800 tests, 0 échec**.

