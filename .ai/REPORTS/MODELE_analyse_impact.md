# 🔍 MODÈLE — ANALYSE D'IMPACT (AVANT MODIFICATION)

> Copier en `analyse_impact_<AAAA-MM-JJ>_<sujet>.md`.
>
> ⛔ **Obligatoire avant toute modification de code.** Le développement ne peut
> pas commencer tant que cette analyse n'est pas enregistrée dans `.ai/REPORTS/`.
> Voir `CODING_RULES.md` §14.

---

# Analyse d'impact — <sujet>

**Date** : AAAA-MM-JJ
**Réf.** : B-XXX / BUG-XXX
**Composant modifié** : `<chemin/du/fichier.kt>`
**Nature** : correctif · fonctionnalité · refactor · suppression
**Commit de référence** : `<sha>`

---

## 1. Quels fichiers utilisent **directement** le composant ?

Recherche exhaustive, pas de mémoire :

```bash
grep -rn "<NomDuComposant>\|<nomDeFonction>" app/src --include=*.kt
```

| # | Fichier:ligne | Usage | Couche |
|---|---|---|---|
| 1 | | | UI / VM / Repo / Worker / Receiver |

**Total : N appelants directs.**

## 2. Quels composants l'utilisent **indirectement** ?

Remonter la chaîne d'appel de chaque appelant direct jusqu'aux points d'entrée.

```
<Composant>
  └─ <appelant direct>
       └─ <appelant de l'appelant>
            └─ <point d'entrée : écran, worker, receiver>
```

| Chemin | Profondeur | Déclencheur final |
|---|---|---|

## 3. Quels **ViewModel** seront impactés ?

| ViewModel | Fonctions concernées | Signature modifiée ? | État exposé modifié ? |
|---|---|---|---|

⚠️ Sur ce projet, `MainViewModel` est **unique et partagé par tous les écrans** :
toute modification de signature a un rayon d'impact maximal.

## 4. Quels **écrans** seront impactés ?

| Écran | Interaction | Modification UI requise ? | Parcours utilisateur affecté |
|---|---|---|---|

## 5. Quels **Workers ou Services** seront impactés ?

| Composant | Type | Impact | Contrainte particulière |
|---|---|---|---|

⚠️ Vérifier systématiquement : `BackupWorker`, `SubscriptionWorker`,
`SmsReceiver`. Ils s'exécutent **sans interface** : aucune saisie utilisateur
n'y est possible.

## 6. Quels **tests existants** couvrent déjà cette fonctionnalité ?

| Test | Type | Couvre | Sera-t-il cassé ? |
|---|---|---|---|

```bash
grep -rln "<Composant>" app/src/test app/src/androidTest
```

Si aucun test n'existe : **le dire**, et considérer que la modification se fait
sans filet.

## 7. Quels **nouveaux tests** devront être créés ?

| Test à écrire | Type | Ce qu'il prouve | Priorité |
|---|---|---|---|

Rappel `CODING_RULES.md` §13.6 : composant critique ⇒ **double validation**
(implémentation de référence indépendante **et** tests Kotlin).

## 8. Quels **risques de régression** existent ?

| # | Risque | Probabilité | Gravité | Atténuation |
|---|---|---|---|---|

Questions à passer en revue systématiquement :
- une signature publique change-t-elle ?
- un comportement par défaut change-t-il silencieusement ?
- les données existantes restent-elles lisibles ?
- un format persisté (fichier, base, préférence) évolue-t-il ?
- un chemin d'erreur devient-il muet ?
- la sécurité est-elle affaiblie (`SECURITY.md` §0) ?
- une fonctionnalité hors ligne devient-elle dépendante du réseau ?

## 9. Quels composants devront être **revérifiés** après la modification ?

Liste de contrôle post-correction, reprise telle quelle dans l'analyse d'impact
*post-correction* :

- [ ] `<composant 1>` — <vérification attendue>
- [ ] `<composant 2>` — <vérification attendue>

---

## 10. Décision

**Périmètre retenu** :
**Explicitement hors périmètre** :
**Ordre d'exécution** :
**Point de non-retour** : <à partir d'où un retour arrière devient coûteux>

## 11. Analyse par rôle *(si décision structurante)*

Voir `PROMPTS/roles.md`.

| Rôle | Verdict | Réserve |
|---|---|---|

---

**Analyse validée le** : AAAA-MM-JJ
**Le développement peut commencer** : ☐ oui ☐ non — motif :
