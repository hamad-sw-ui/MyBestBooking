# T-127 — Analyse d'impact (§14) : correctifs de l'audit fonctionnel n°7

- **Date** : 2026-08-28 · **Niveau** : **L** (validations locales, aucun contrat cassé, aucune migration).
- **Origine** : `REPORTS/audit_fonctionnel_profond7_2026-08-28.md`.
- **Principe** : corrections **additives** de robustesse ; les cas valides gardent exactement le même comportement.

## Périmètre

| Ref | Correctif | Fichiers |
|-----|-----------|----------|
| P1 | Vérifier l'existence de la propriété avant d'insérer une **alerte de prix** ou un **favori** → 404 propre (au lieu d'un 500 par violation FK). | `src/app/api/price-alerts/route.ts`, `src/app/api/wishlists/route.ts` |
| P2 | Appliquer la vérification **magic bytes** (`sniffImageMime`, T-126) à l'upload des **pièces jointes de messagerie** (`/api/uploads`) ; stocker le MIME détecté. | `src/app/api/uploads/route.ts` |
| P3 | Export de facturation : lire/valider les filtres de période `from`/`to` (`YYYY-MM-DD`, `from ≤ to`) ; sans paramètre → export complet (historique). | `src/app/api/dashboard/billing/export/route.ts` |

## Les 9 questions (§14)

1. **Fichiers touchés** : 4 routes API, aucune dépendance nouvelle (le helper `sniffImageMime` existe déjà depuis T-126).
2. **Contrats d'API** : aucun champ modifié. Seuls des codes retour changent sur des entrées invalides : propriété inexistante en alerte/favori passe de **500 à 404** ; pièce jointe non-image passe de **200 à 400** ; l'export gagne un paramètre optionnel (400 si mal formé). Les appels valides sont inchangés (201/200).
3. **Données** : aucune migration, aucun changement de schéma. La FK `property_id` garantissait déjà qu'aucune ligne orpheline n'était écrite (vérifié : 0 orphelin après tests) ; on transforme juste l'erreur en réponse propre.
4. **Parcours (3 rôles)** : customer (alertes/favoris/pièces jointes) — messages d'erreur clairs sur cible inexistante, vraies images acceptées ; host/admin — export filtrable par période, export complet par défaut ; customer reste 403 sur l'export.
5. **Composants critiques** : aucun impact financier (commission/wallet/promos non touchés), aucun flux de réservation modifié.
6. **Tests existants** : 251 tests toujours au vert ; le helper sniff a déjà 6 tests (T-126). Pas de nouvelle unité nécessaire (routes intégration testées via smoke + exécution).
7. **Effets de bord** : un `SELECT … LIMIT 1` par PK ajouté dans alertes/favoris (négligeable, indexé).
8. **Risques de régression** :
   - P1 : on vérifie **l'existence seulement**, pas `status='active'`, pour ne pas casser un favori sur une propriété momentanément suspendue (l'item reste en base). L'alerte sur propriété existante (même inactive) reste possible — le cron fait déjà un `leftJoin` et ignore les propriétés nulles ; une propriété inactive est juste sans annonce publique.
   - P2 : le MIME déclaré par le client reste vérifié d'abord (rejet rapide), puis le MIME réel (`realMime`) est utilisé pour le stockage **et** pour `upload_objects.mimeType` — cohérent avec le commentaire « le MIME est une propriété de l'objet uploadé ». Les vraies images passent.
   - P3 : sans `from`/`to`, la requête est strictement identique à l'avant (export complet). Les filtres ne s'appliquent que si au moins un paramètre est fourni.
9. **Validation (§13)** : typecheck · lint · tests · build · smoke · ai:check + exécution réelle des 3 parcours.

## Rollback
Révert des commits ; aucune migration à annuler.
