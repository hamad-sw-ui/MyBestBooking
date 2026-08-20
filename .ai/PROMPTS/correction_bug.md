# 🐞 PROMPT — CORRECTION DE BUG

```
Tâche : corriger le bug BUG-XXX décrit dans .ai/BUGS.md.

Procédure obligatoire :
0. RÉDIGER L'ANALYSE D'IMPACT (.ai/REPORTS/analyse_impact_<date>_<sujet>.md)
   AVANT toute modification — 9 questions obligatoires (CODING_RULES §14).
1. Relire l'entrée BUG-XXX et les fichiers cités.
2. REPRODUIRE ou PROUVER le défaut avant de corriger (test, trace, lecture argumentée).
3. Identifier la cause racine — pas le symptôme.
4. Lister tous les appelants impactés (grep).
5. Passer la correction à la grille des 11 rôles (.ai/PROMPTS/roles.md).
6. Corriger de façon minimale : aucun refactor opportuniste.
7. Ajouter un test de non-régression.
8. Dérouler .ai/CHECKLISTS/avant_commit.md.
9. Produire l'analyse d'impact POST-CORRECTION (prévu vs constaté).
10. Mettre à jour BUGS.md — statut CORRIGÉ (INSPECTION) ou CORRIGÉ (VALIDÉ)
    selon les preuves réellement obtenues (§13) —, PROGRESS.md, BACKLOG.md.
```

---

## Règles spécifiques

### Ne jamais corriger un symptôme
Exemple sur ce projet : ajouter `fallbackToDestructiveMigration()` pour faire
disparaître le crash de BUG-001 **détruirait les données du commerçant**.
La cause racine est la divergence migration ↔ entité.

### Périmètre minimal
Un correctif de bug ne contient **que** le correctif. Si l'on découvre trois
autres problèmes en chemin : les consigner dans `BUGS.md`, ne pas les traiter.

### Preuve avant correction
Ordre imposé :
1. écrire le test qui échoue ;
2. corriger ;
3. vérifier que le test passe.

Si l'écriture d'un test est impossible (UI, matériel Bluetooth), décrire le
protocole de vérification manuelle dans `PROGRESS.md`.

### Bugs touchant les données
Pour tout bug sur `AppDatabase`, `SecurityUtil` ou la sauvegarde :
- rédiger un `REPORTS/rapport_analyse_<date>.md` **avant** de coder ;
- décrire explicitement l'effet sur une base existante déjà remplie ;
- prévoir un chemin de récupération pour les utilisateurs déjà touchés.

---

## Modèle de clôture (à recopier dans `BUGS.md`)

```markdown
**Statut** : CORRIGÉ le <date> — commit `<sha>`
**Cause racine** : <une phrase>
**Correctif** : <ce qui a été changé et pourquoi>
**Test de non-régression** : <fichier::méthode>
**Effet sur les bases existantes** : <aucun | migration n→n+1 | action utilisateur requise>
```
