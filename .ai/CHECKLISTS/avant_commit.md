# ✅ Aide-mémoire — avant un commit

⚠️ **Ceci n'est pas une gate**. Vous pouvez committer sans avoir tout coché.
C'est juste ce qu'on aimerait vérifier quand on en a le temps.

- [ ] `npm run lint` passe (ou l'erreur restante est comprise et acceptée)
- [ ] `npm run typecheck` passe
- [ ] Le code touché a été relu une fois par soi-même
- [ ] Les secrets n'ont pas été committés (pas de `.env`, pas de clé)
- [ ] Le message de commit décrit **le pourquoi**, pas juste le quoi
- [ ] Si on a touché à `src/db/schema.ts` → note ajoutée dans `DATABASE.md`
- [ ] Si on a ajouté/modifié une route API → note ajoutée dans `API.md`
- [ ] Si on a introduit une bizarrerie connue → ligne ajoutée dans `BUGS.md`
