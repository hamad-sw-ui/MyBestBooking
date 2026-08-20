# ✅ PROTOCOLE — Vérification manuelle des chemins de sauvegarde (B-157)

> Exigence ❌ bloquante de l'Expert QA (débat du 2026-07-28) : sans état de
> référence, l'affirmation « aucune régression » est invérifiable.
>
> **À exécuter deux fois** : AVANT le branchement de `BackupManager` (référence),
> puis APRÈS (comparaison). Résultats consignés dans `.ai/REPORTS/`.

**Appareil** : ______________  **Android** : ____  **Version app** : ____
**Date** : __________  **Passe** : ☐ AVANT ☐ APRÈS

---

## Préparation — jeu de données de référence

- [ ] Boutique configurée (nom, téléphone, `managerCode` ≥ 12 caractères)
- [ ] 3 produits en stock, dont 1 avec code-barres
- [ ] 5 ventes : 2 espèces, 2 MoMo, 1 à crédit
- [ ] 1 client avec dette
- [ ] 1 dépense

**Empreinte de référence** — à relever avant chaque passe :

| Donnée | Valeur |
|---|---|
| Nombre de ventes | ____ |
| Total du chiffre d'affaires | ____ |
| Nombre de produits | ____ |
| Dette du client test | ____ |

---

## Chemin A — Export depuis Paramètres

1. Paramètres → « Exporter et partager la base »
2. Choisir une destination (Drive, e-mail…)

- [ ] A1 · Aucun plantage
- [ ] A2 · Un fichier est bien produit
- [ ] A3 · Le sélecteur de partage s'affiche
- [ ] A4 · Nom du fichier : ______________________
- [ ] A5 · Taille : ______ *(non nulle)*
- [ ] **APRÈS uniquement** — un mot de passe est demandé
- [ ] **APRÈS uniquement** — un mot de passe faible est refusé

## Chemin B — Export depuis la Clôture

1. Clôture → « Sauvegarde Totale (.db) »

- [ ] B1 · Aucun plantage
- [ ] B2 · Fichier produit, sélecteur affiché
- [ ] B3 · **APRÈS** — mot de passe demandé (même dialogue qu'en A)

## Chemin C — Restauration manuelle

1. Paramètres → Restauration → choisir le fichier exporté en A
2. Confirmer

- [ ] C1 · Le fichier est sélectionnable
- [ ] C2 · L'avertissement d'écrasement s'affiche
- [ ] C3 · L'application redémarre sur le Splash
- [ ] C4 · 🔴 **Les données correspondent à l'empreinte de référence**
- [ ] C5 · 🔴 **L'application reste utilisable** (naviguer, créer une vente)
- [ ] C6 · **APRÈS** — mot de passe demandé, mauvais mot de passe → échec propre
- [ ] C7 · **APRÈS** — un `.db` legacy reste restaurable *(rétrocompatibilité)*

## Chemin D — Miroir au premier lancement *(ne doit PAS changer)*

1. Désinstaller, réinstaller *(le miroir externe survit)*
2. Au Setup, accepter « Anciennes données trouvées »

- [ ] D1 · Le dialogue apparaît
- [ ] D2 · La restauration aboutit
- [ ] D3 · 🔴 **Aucun mot de passe n'est demandé** *(pas d'interface disponible)*
- [ ] D4 · Données conformes à l'empreinte

## Chemin E — Sauvegarde automatique *(ne doit PAS changer)*

```bash
adb shell run-as com.reconsiliation.caisse ls -l files/daily_backup.db
adb shell ls -l /sdcard/Android/data/com.reconsiliation.caisse/files/caisse_mirror.db
```

- [ ] E1 · `daily_backup.db` présent, taille non nulle
- [ ] E2 · `caisse_mirror.db` présent
- [ ] E3 · 🔴 **Format `.db` brut conservé** (pas une archive ZIP)
- [ ] E4 · **Mode avion** → la sauvegarde s'exécute quand même *(B-014)*

## Vérification transverse — checkpoint WAL (B-013)

- [ ] W1 · Créer une vente **juste avant** un export
- [ ] W2 · Restaurer cet export sur un appareil vierge
- [ ] W3 · 🔴 **La dernière vente est présente** *(sinon le WAL n'est pas vidé)*

---

## Résultat

| Chemin | AVANT | APRÈS | Régression ? |
|---|---|---|---|
| A — Export Paramètres | ☐ | ☐ | |
| B — Export Clôture | ☐ | ☐ | |
| C — Restauration | ☐ | ☐ | |
| D — Miroir Setup | ☐ | ☐ | |
| E — Worker | ☐ | ☐ | |
| W — Checkpoint WAL | ☐ | ☐ | |

**Verdict** : ☐ aucune régression ☐ régression détectée : ______________

> ⛔ Une case 🔴 non cochée en passe APRÈS **bloque** le branchement.
