# Tâche courante

- **ID** : T-193
- Titre : Audit runtime exhaustif du site (crawl 5 profils rôle×langue) →
  verdict propre, outil rejouable `npm run site:audit` (faux positifs
  documentés : profil FR prioritaire au cookie ; jamais d'URL inventée)
- **Statut** : CORRIGÉ (VALIDÉ) ✅
- **Niveau** : **S**

## Description
Crawl HTTP complet (236 pages : anon/admin/hôte/voyageur × FR, anon EN) :
0 HTTP 500, 0 vraie 404, 0 résidu FR en EN anonyme, pages légales EN
conformes (« Privacy policy », « Legal notice »). L'outil est versionné
et rejouable : `npm run site:audit` (exit 1 si issue). Tri des faux
positifs du prototype : comptes connectés fr par profil (voulu),
/hebergements et /conditions n'étaient pas de vraies routes. Aucun code
produit modifié.

## Sprint de fermeture (tous ✅)
- [x] crawl exhaustif exécuté : 236 pages, 0 issue
- [x] script versionné + npm script `site:audit`
- [x] `npm run ci` complet VERT (484/484, smoke 94/94)
- [x] rapports + gouvernance · ai:check 20/0/0

## Précédentes tâches
- T-192 — KNOWN_LIMITATIONS purgé + `npm run env:restore` — **VALIDÉ** ✅
- T-191 — CI reproductible `npm run ci` + workflow GHA prêt — **VALIDÉ** ✅
- T-190 — backlog resynchronisé — **VALIDÉ** ✅

## Prochaine
- **ID** : T-194
- La surface produit auditée est propre. Pistes demandant une décision :
  (a) activer le workflow GHA (permission `workflows` — main humaine
  requise) ; (b) arbitrer T-108→T-112 (architecture, décision produit) ;
  (c) ajouter `site:audit` à la chaîne `npm run ci` (nécessite l'app
  servie — à cadrer) ; (d) badge statut CI dans README après (a).
