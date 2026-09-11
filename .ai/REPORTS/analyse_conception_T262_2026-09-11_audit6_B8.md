# Analyse de conception — T-262 (audit n°6, B8)

- **Date** : 2026-09-11 · **Tâche courante** : T-262 · **Niveau** : S
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.8

## 1. Problème

`DELETE /api/users/me` anonymise l'identité (T-242) **sans toucher** `users.wallet_balance` ni
`wallet_transactions`. Un voyageur qui avait accumulé un crédit (cashback BestRewards, parrainage,
remboursements — gel T-248 §3) voyait donc son solde disparaître **sans un mot** : la ligne restait
en base, attachée à `deleted-…@anonymized.local`, Ni consultable (session révoquée), ni utilisable
(gel), ni remboursée — et sans aucune trace permettant au support d'expliquer ce qui s'est passé.

C'est le seul scénario où le gel produit un effet **défavorable** à l'utilisateur.

## 2. Options

| Option | Verdict |
|---|---|
| Rembourser le solde à la suppression | **Écartée** : consommation/versement = rupture du gel T-248 §3 (décision produit) |
| Refuser la suppression tant que le solde est > 0 | **Écartée** : bloquerait un droit RGPD pour un montant parfois minime |
| Afficher le solde dans la boîte de confirmation et journaliser une trace à montant nul | **Retenue** : conforme au gel, réversible, additive |

## 3. Conception retenue

- **Un écrivain dédié** : `recordAccountClosureEntry(executor, { userId, balance })` insère
  `kind = "account_closed"`, `amount = "0.00"`, `balanceAfter = <solde>` et une note explicite.
  `recordWalletEntry()` reste inchangé (il ignore les mouvements nuls : un journal rempli de zéros
  serait illisible).
- **Dans la transaction** de suppression : `anonymizeUserAccount()` puis la trace — soit les deux
  passent, soit aucune (le journal ne peut pas diverger de l'état du compte).
- **Conditionnelle** : seulement si `walletBalance > 0` (aucun crédit perdu = aucune ligne).
- **Avertissement AVANT l'action** : l'encart de la zone de danger affiche le montant dans la devise
  d'affichage (mêmes helpers que la carte wallet : `normalizeDisplayCurrency` + `formatPrice` /
  `convertAmount` + `formatMoney`) et rappelle la nature du crédit (« crédit futur, non utilisé et
  non remboursable »).
- **Aucune migration** : `wallet_transactions.kind` est un `varchar(32)`, `account_closed` (14
  caractères) y entre sans changement de schéma ; le journal reste append-only.

## 4. Dette restante (assumée)

- Le solde gelé d'un compte supprimé **n'est pas** reversé (décision produit) : la ligne de journal
  est une trace, pas une promesse de paiement.
- Le champ `note` est rédigé en français (journal interne, hors surface UI traduite).
