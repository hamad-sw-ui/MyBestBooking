# Analyse d'impact — Audit n°30 (T-160)

- **Date** : 2026-08-30
- **Tâche** : T-160 (audit fonctionnel profond n°30 — rapport seul ; implémentation T-160→T-166 à arbitrer)
- **Niveau** : S
- **Surface impactée** : aucun fichier `src/` modifié dans ce jalon (rapport). L'implémentation future toucherait : `src/app/(main)/mes-favoris/page.tsx` + `src/lib/ui-strings.ts` (T-160), `src/app/api/price-alerts/route.ts` + `src/app/api/cron/price-alerts/route.ts` (T-161), 5 pages publiques + `src/lib/ui-strings.ts` (T-162), `src/app/(main)/wishlists/share/[token]/page.tsx` (T-163), `src/components/currency-selector.tsx` + `search-price-filter.tsx` (T-164), `src/lib/mail/templates.ts` + cron (T-165), `scripts/run_all_sims.py` + `scripts/purge-sim-data.mjs` (T-166).
- **Risques** :
  - N+1 → jointure : modifier la forme de requête sans changer le rendu (Structure identique, ordre identique, `itemCount` préservé) ;
  - purge wishlists : ne jamais supprimer une liste réelle (critères d'artefacts explicites + `--dry-run` par défaut) ;
  - validation dates passées : les alertes existantes (légitimes futures) ne doivent pas être touchées — uniquement les NOUVELLES créations ;
  - i18n : le français reste le défaut (`uiStrings` → fr si locale inconnue) ; aucun libellé clé renommé (additif) ;
  - 404 streaming : `generateMetadata` ne doit pas dupliquer l'appel réseau (mutualisation) ;
  - e-mails : remplacer `?? ""` par un helper — contenu inchangé quand `APP_URL` est défini (cas actuel).
- **Preuves attendues** : `tsc` 0 · `vitest` (suite complète + nouveaux tests : POST date passée 400, cron désactive, count dédupliqué, métadonnées EN) · `run_all_sims.py` 5/5 0 KO · probes audit n°30 rejouées vertes · purge `--dry-run` puis `--apply` (0 wishlist d'artefact restant).
- **Plan de non-régression** : (1) git diff limité aux fichiers listés ; (2) sims complets avant/après ; (3) contrats API publics intacts (aucun champ supprimé, aucun code HTTP modifié hors 400 nouveau) ; (4) cas EUR numériquement identiques ; (5) `ai:check` 0 fail.
