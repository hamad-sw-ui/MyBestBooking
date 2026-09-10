# Analyse d'impact T-211 — Wrapper `site:audit:prod`

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Niveau** : L — outillage local de validation, aucun changement produit
- **Auteur** : Agent Arena.ai

## Demande / origine

Suite T-210 : `site:audit` est fiable contre un serveur production (`next start`) mais peut produire des faux rouges sur un long crawl lancé contre `next dev`/Turbopack. T-211 ajoute une commande dédiée pour automatiser le chemin validé : build → `next start` → attente santé → `site-audit` → arrêt.

## Q1. Fichiers directement impactés

- `package.json` : ajout du script npm `site:audit:prod`.
- Nouveau script `scripts/site-audit-prod.mjs` : orchestration locale du build, du serveur production et du crawl.
- Documentation `.ai` : tâche courante, validation, progression, traçabilité.

## Q6. Tests existants / validations couvrant déjà ce comportement

- `scripts/site-audit.mjs` couvre le crawl, les profils et les erreurs fonctionnelles.
- `npm run build` prouve que `next start` peut servir le bundle.
- `npm run ai:check` vérifie les conventions `.ai` et les scripts attendus.
- `git diff --check` contrôle l'hygiène whitespace.

## Q8. Risques de régression

| Risque | Parade |
|---|---|
| Tuer un serveur utilisateur déjà actif | Utiliser un port dédié configurable (`SITE_AUDIT_PROD_PORT`, défaut hors 3000) et arrêter uniquement le PID lancé par le wrapper. |
| Masquer les logs utiles en cas d'échec | Relayer stdout/stderr du build et de l'audit ; conserver un tail du serveur en cas de non-démarrage. |
| Laisser un `next start` tourner après erreur | Installer un `finally`/handlers signaux et tuer le groupe de process lancé. |
| Alourdir la validation normale | Garder `npm run site:audit` inchangé ; `site:audit:prod` est opt-in. |
| Changer le produit | Aucune route, API, composant, DB ou logique métier modifiés. |

## Conclusion

Impact limité à l'outillage. La preuve attendue est l'exécution réelle de `npm run site:audit:prod` sur le workspace courant.
