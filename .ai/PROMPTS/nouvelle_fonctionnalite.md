# ✨ PROMPT — NOUVELLE FONCTIONNALITÉ

```
Tâche : implémenter <fonctionnalité> (réf. BACKLOG B-XXX).

Procédure obligatoire :
1. Lire .ai/ (CURRENT_TASK, ARCHITECTURE, CODING_RULES, ANDROID_RULES + le fichier
   du domaine concerné).
2. Vérifier que la fonctionnalité n'existe pas déjà, même partiellement (grep).
2bis. RÉDIGER L'ANALYSE D'IMPACT dans .ai/REPORTS/ (CODING_RULES §14) —
      le développement ne commence qu'après.
3. Concevoir AVANT de coder : entités, DAO, repository, ViewModel, écran, navigation.
4. Passer la conception à la grille des 11 rôles (.ai/PROMPTS/roles.md).
5. Implémenter de bas en haut : données → repository → ViewModel → UI.
6. Écrire les tests au fur et à mesure, pas à la fin.
7. Dérouler avant_commit.md puis avant_pull_request.md.
8. Mettre à jour .ai/ (ARCHITECTURE, DATABASE, BACKLOG, PROGRESS).
```

---

## Ordre d'implémentation imposé

```
1. Entité Room (+ migration + test de migration)   ← si la donnée est nouvelle
2. DAO (+ requêtes indexées)
3. Repository (fonctions suspend / Flow)           ← + tests unitaires
4. UiState + ViewModel                             ← + tests
5. Composables (écran + composants)
6. Route de navigation (+ rôle requis si sensible)
7. Chaînes dans strings.xml
8. Mise à jour de .ai/
```

Ne jamais commencer par l'écran : sur ce projet, l'UI existante est riche et
l'on croit souvent à tort qu'une fonctionnalité manque alors qu'elle est
seulement non branchée.

---

## Questions préalables (à trancher avant d'écrire une ligne)

| Question | Pourquoi |
|---|---|
| La donnée doit-elle survivre à une désinstallation ? | Détermine la stratégie de sauvegarde |
| Est-elle sensible ? | Détermine le rôle requis et la journalisation |
| Faut-il tracer dans `action_logs` ? | Contrôle anti-fraude |
| Quel comportement hors ligne ? | L'app est hors-ligne par défaut |
| Que voit un STAFF vs un MANAGER ? | `hideProfitsFromStaff` existe déjà |
| Impact sur la clôture et les rapports ? | Les totaux doivent rester cohérents |
| Volumétrie à 2 ans ? | Détermine pagination et index |

---

## Définition de « terminé »

- [ ] Code conforme à `CODING_RULES.md` et `ANDROID_RULES.md`
- [ ] Aucune régression sur les parcours existants
- [ ] Tests écrits et passants (ou protocole manuel documenté)
- [ ] Textes dans `strings.xml`
- [ ] Mode sombre vérifié
- [ ] Comportement en cas d'erreur défini et visible
- [ ] `.ai/` à jour
- [ ] Tâche cochée `☑` dans `BACKLOG.md`
