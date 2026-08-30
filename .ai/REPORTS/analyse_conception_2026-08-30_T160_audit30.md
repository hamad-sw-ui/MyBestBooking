# Analyse de conception — Audit n°30 (T-160)

- **Problème** : 7 findings à l'exécution (2 P2, 5 P3) — favoris pollués/performants, alertes prix passées, i18n public, 404 sauvegardé à 200, label devise SSR, liens e-mail conditionnels, hygiène des runs. Détail : `.ai/REPORTS/audit_fonctionnel_profond30_2026-08-30.md`.
- **Options évaluées** :
  - Favoris : (a) purge SQL directe ; (b) critères dans `purge-sim-data.mjs` + nettoyage dans le runner ; (c) supprimer toute liste vide (risqué : utilisateur réel) → retenu : **(b) + critères stricts** (`rate-test-*`, noms de sims, listes créées par le run) ;
  - N+1 : (a) jointure agrégée unique ; (b) cache ; (c) pagination → retenu : **(a)** (additif, rendu identique) + compteur `Set(propertyId)` ;
  - Alertes : (a) 400 à la création + désactivation cron ; (b) suppression à l'expiration → retenu : **(a)** (conservateur, aucune notification perdue en transition) ;
  - i18n : (a) `getServerLocale()`+`makeT` (pattern validé n°29) ; (b) librairie i18n lourde → retenu : **(a)** ;
  - 404 : (a) `notFound()` dans `generateMetadata` (statut 404 avant streaming, données mutualisées) ; (b) middleware → retenu : **(a)** ;
  - Devise SSR : (a) prop `initialLanguage` ; (b) rendre le sélecteur côté serveur → retenu : **(a)** (le hook conserve la priorité compte > localStorage > plateforme) ;
  - E-mails : (a) helper `appBaseUrl()` + repli documenté ; (b) exiger la variable → retenu : **(a)** (pas de régression en dev où la variable est absente).
- **Solution retenue** : implémenter T-160→T-166 dans un cycle dédié (même organisation que n°28→n°29), en gardant : aucun migration, aucun contrat API public modifié, additif strict, français par défaut, `--dry-run` par défaut pour la purge.
- **Alternatives écartées** : suppression aveugle des listes vides (risque de perte de données utilisateur) ; désactivation par date plutôt que validation (l'expiration reste utile en filet) ; refactor complet de l'UI favoris (hors périmètre, régression potentielle).
- **Migration et rollback** : aucune migration de schéma (T-160/161/166 = données + requêtes) ; rollback = `git revert` du commit d'implémentation (les fichiers modifiés sont isolés) ; la purge est idempotente et dry-run par défaut.
