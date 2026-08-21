# Prompt — correction d'un bug

À adapter en remplaçant les `<…>`.

---

Un bug est signalé : **<symptôme observé, étapes de reproduction, message
d'erreur si applicable>**.

Consulte `.ai/BUGS.md` : s'il y est déjà répertorié, reprends l'ID (`B-xxx`).
Sinon, ajoute une entrée à la fin.

Procédure suggérée :

1. **Reproduire** le bug (localement ou par lecture du code + Grep). Identifie
   le fichier et la ligne exacte du défaut.
2. **Expliquer la cause racine** en 2-3 phrases, sans jargon.
3. **Proposer le fix minimal** qui règle le problème sans changer d'autres
   comportements.
4. **Signaler les effets de bord** possibles : autres endroits qui dépendent
   du même code, migrations à prévoir, changement d'API publique.
5. Appliquer le patch, mettre à jour `.ai/BUGS.md` (déplacer l'entrée en
   « Corrigés » avec la date) et ajouter une note dans `.ai/DEVLOG.md`.

Aucune obligation de produire un rapport formel — un commit propre avec un
bon message suffit.
