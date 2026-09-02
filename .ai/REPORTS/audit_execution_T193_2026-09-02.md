# Audit d'exécution — T-193 (audit runtime site-wide + outillage)

- **Date** : 2026-09-02
- **Contexte** : pistes restantes T-193 (CI GHA, T-108→112) bloquées sur
  permission/décision. Conduite d'un **crawl runtime exhaustif** pour
  découvrir des remarques réelles.

## Crawl exploratoire (trouvailles et tri)

236+ pages × (anon/admin/hôte/voyageur × FR/EN) — résultats :

1. **« marqueurs FR en EN » chez les rôles connectés** — FAUX POSITIF :
   le profil utilisateur (`language: fr`) a priorité sur le cookie langue
   (getServerLocale : profil > header > cookie) — comportement voulu et
   documenté. En **anonyme EN : zéro résidu** (légale « Privacy policy » /
   « Legal notice » OK, aucune chaîne FR).
2. **« 404 /hebergements, /conditions »** — FAUX POSITIF du script :
   aucun lien interne n'y pointe (grep du src) ; ces URLs étaient des
   seeds inventées. Retirées.
3. **Aucune HTTP 500**, aucune vraie 404, aucune exception.

## Outillage livré

`scripts/site-audit.mjs` + `npm run site:audit` :
- seeds = routes publiques réelles + liens internes découverts (jamais
  d'URL inventée) ;
- EN crawlé uniquement en anonyme (profil > cookie) ;
- attendus explicites sur les pages légales EN ;
- exit 1 si issue, message clair si l'app n'est pas démarrée.

## Verdict
Le produit est **propre au runtime** : 236 pages, 0 issue. Pas de bug à
implémenter ; l'audit devient un outil rejouable. Aucun code produit
modifié.
