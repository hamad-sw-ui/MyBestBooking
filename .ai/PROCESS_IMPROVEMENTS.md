# 🔄 PROCESS_IMPROVEMENTS — journal des rétrospectives

Ce document capture les **améliorations du framework `.ai/` lui-même**,
séance après séance, conformément à `CODING_RULES.md` §17. Les propositions
ne s'appliquent **pas automatiquement** : elles alimentent une discussion
avec le responsable qui décide.

## Convention

Chaque entrée porte :

- **Date**
- **Contexte** — quelle session, quelle tâche
- **Ce qui a bien marché**
- **Ce qui a mal marché**
- **Propositions** — à ajouter, à modifier, à **retirer**
- **Décision** — statuée par le responsable, ou en attente

Une règle du framework qui **n'a servi personne en 3 sessions consécutives**
est explicitement candidate à la suppression.

---

## 2026-08-20 — Session 2 : mise en place du framework

**Tâche** : B-000 (mise en place du framework de gouvernance v1.0.0).

### Ce qui a bien marché

- La conservation de la couche contenu (PROJECT/ARCHITECTURE/…) permet
  d'ajouter la gouvernance sans jeter le travail précédent.
- Le manifest JSON force la cohérence : lister explicitement
  `mandatory_documents` évite qu'on en oublie un.
- La proportionnalité T/L/S/C évite d'appliquer le même cérémonial à une
  typo et à une refonte de l'auth.

### Ce qui a mal marché

- **Interprétation ambiguë** : la première réécriture avait supprimé la
  gouvernance. Le mot « gate » n'est pas univoque. Leçon : demander une
  clarification par `ask_user` dès qu'un mot du responsable est
  interprétable de deux façons contradictoires.
- **Rien n'automatise** la vérification du framework : un fichier
  obligatoire supprimé ne provoque aucune alerte. À traiter.

### Propositions

1. 🟢 **Ajouter** `scripts/check-ai.mjs` qui :
   - vérifie que chaque `mandatory_documents` du manifest existe ;
   - vérifie que `CURRENT_TASK.md` référence bien une tâche ouverte ;
   - vérifie que `STATE.md` a été mis à jour depuis le dernier commit non-doc.
   → à discuter, sortirait du périmètre `.ai/` (`scripts/` = code).
2. 🟢 **Ajouter** un hook Git pré-commit qui rejette un commit dont le
   message n'a pas de `<type>(<scope>)`.
3. 🟡 **Envisager** l'ajout d'un runner qui compte les tags §16 par rapport
   dans `REPORTS/` : un rapport sans 🔨/🧪/▶️ pour une tâche C serait signalé.
4. 🔴 **Ne rien retirer** pour l'instant — le framework n'a que 2 sessions
   de recul, il faut le laisser vivre.

### Décisions

- Proposition 1, 2 : **en attente** de validation par le responsable.
- Proposition 3 : **notée pour plus tard**.
- Proposition 4 : **actée** — on garde tout tel quel jusqu'à au moins la
  session 5.

---

## Historique des règles

Ce sous-registre enregistre les **modifications du framework lui-même** —
règles ajoutées, retirées, renumérotées. Il permet de comprendre pourquoi
telle règle existe.

| Date | Règle | Action | Motif |
|---|---|---|---|
| 2026-08-20 | §1–§22 | **Créées** avec la v1.0.0 | Mise en place initiale du framework hybride pour MyBestBooking, dérivé d'AI-DOS 3.0 (MobileCaisse). |
