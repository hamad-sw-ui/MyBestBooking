# Analyse d'impact — T-262 (audit n°6, B8 : crédit gelé à la suppression de compte)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **BASE** : `dfd0a5e`
- **Niveau** : **S** (une fonction de journal, un encart conditionnel ; aucune migration,
  aucun changement de contrat d'API).
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.8 (B8)
- **Rapport de validation** : `.ai/REPORTS/validation_T262_2026-09-11_audit6_B8.md`

## 1. Surfaces touchées

| Fichier | Nature | Rôle |
|---|---|---|
| `src/lib/wallet-ledger.ts` | modifié | type `account_closed` + `recordAccountClosureEntry()` (montant **0**) |
| `src/app/api/users/me/route.ts` | modifié | écrit la trace **dans la transaction** de suppression, si solde > 0 |
| `src/components/delete-account-section.tsx` | modifié | encart conditionnel « crédit perdu » (montant formaté) |
| `src/app/(main)/mon-compte/account-client.tsx` | modifié | transmet `walletBalance` (déjà présent dans `/api/auth/me`) |
| `src/lib/ui-strings.ts` | modifié | +1 clé FR/EN (`account.deleteWalletWarning`) |
| `src/lib/wallet-policy.test.ts` | modifié | garde-fou : la suppression **trace** sans consommer |
| `src/app/api/users/me/route.t262.test.ts` | **créé** | 2 tests d'intégration (base réelle) |
| `src/components/delete-account-section.test.tsx` | **créé** | 2 tests de rendu (encart présent / absent) |

## 2. Effets indirects

1. **Gel T-248 §3** : la ligne écrite porte `amount = "0.00"` ; `users.wallet_balance` n'est **jamais**
   mis à jour. Une revue automatique (`wallet-policy.test.ts`) refuse désormais une suppression qui
   réintroduirait une mutation du solde.
2. **Journal wallet** : `recordWalletEntry()` ignore volontairement les montants nuls — la clôture a
   donc son propre écrivain (`recordAccountClosureEntry`), appelé uniquement dans la transaction de
   suppression et seulement si un solde positif disparaît. Aucun autre chemin ne l'appelle.
3. **Historique wallet** (`/api/wallet/transactions`) : la nouvelle ligne apparaît dans l'historique
   d'un compte supprimé, mais ce compte n'a plus de session (T-230) : aucune consultation possible,
   l'entrée sert à l'audit et au support (append-only).
4. **Anonymisation (T-242)** : enchaînée avant l'écriture, dans la même transaction ; un échec de
   l'une annule l'autre (aucune suppression sans trace, aucune trace orpheline).
5. **Contrat d'API** : `DELETE /api/users/me` répond toujours `{ deleted: true }` ; les 409/400
   historiques (réservations actives, annonces non archivées, admin) sont intacts.

## 3. Risques de régression et traitement

| Risque | Traitement |
|---|---|
| Consommer/déduire le solde (violation du gel) | `amount = 0.00`, aucun `update` du solde ; test d'intégration + garde-fou de politique |
| Ligne parasite pour tous les comptes | Écriture **conditionnelle** à `walletBalance > 0` (testé avec un compte à 0) |
| Blocage de la suppression (droit RGPD) | Aucun blocage : l'utilisateur est averti, la suppression reste possible (décision écartée : refus tant que solde > 0) |
| Suppression de la seule colonne `/api/auth/me` utilisée | `walletBalance` était déjà exposé (carte wallet) ; le composant accepte `undefined` (aucun encart) |

## 4. Revérification

`tsc` 0 · `eslint` 0/0 · `route.t262` **2/2** · `delete-account-section` **2/2** ·
`wallet-ledger` **5/5** · `wallet-policy` **3/3** · `ui-strings` **7/7** (verrou **1749**) · sonde
runtime : compte à `12.50` → 200, base `deleted-…@anonymized.local`, `wallet_balance = 12.50`
inchangé, journal `account_closed` `0.00` / `12.50` ; compte jetable et sa ligne supprimés après
la sonde.
