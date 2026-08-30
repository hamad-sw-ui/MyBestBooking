# 🎯 TÂCHE EN COURS

**ID** : T-155 (audit n°27) — TERMINÉ (CORRIGÉ, VALIDÉ)

**Niveau de proportionnalité** : S à L (2 fixes produit additifs +
resynchronisation du harnais de tests)

**Titre** : Remédiation des 9 KO révélés par `run_all_sims.py` — 2 findings
produit réels (code promo inconnu → 400 ; filtre `?amenity=` sur les
chambres) + 7 contrats intentionnels/artefacts documentés + robustesse
des scripts de garde-fou.

**Statut** : **CORRIGÉ (VALIDÉ)** — ▶️ `run_all_sims.py` **5/5 · 396 OK ·
3 WARN · 0 KO** (smoke 94 · surface 68 · deep 80 · xtreme 83 · paranoid 71)
· 🔨 `tsc --noEmit` **0 erreur** · 🧪 vitest **372/372** (52 fichiers) ·
curl : promo inconnue → **400** ; `?amenity=tv|minibar` → **8** propriétés
(avant 0) ; `?amenity=zzz` → 0.

Rapport : `REPORTS/audit_fonctionnel_profond27_2026-08-30.md` (source).

## Synthèse des findings (9 KO → 2 bugs réels, 7 écartés, + 2 robustesse)

**🔴 Bugs produit corrigés**
1. **P2 — `POST /api/bookings`** : code promo inconnu → **409** au lieu de
   400 (`BookingRuleError` unique). Fix : `PromoCodeNotFoundError` → catch
   400 ; les conflits d'état (expiré, épuisé, règles, wallet) restent 409.
2. **P3 — `/recherche?amenity=`** : `tv`/`minibar` sont des amenities de
   **chambres** (`rooms.amenities`), jamais portées par
   `properties.amenities` → 0 résultat. Fix : `OR EXISTS (SELECT 1 FROM
   rooms ra WHERE ra.property_id = properties.id AND ra.amenities @> …)`.

**⚪ Écartés (contrats intentionnels, sims obsolètes)**
3. `GET /reservation` anonyme → 200 : guest mode T-109 (simulate.py →
   section publique ; paranoid_sim vérifie 200).
4. deep 2fa `secret 0 chars` : le setup exige le mot de passe (T-120 D4).
5. deep 2fa disable 400 : exige `password` **+** `code` (sim n'envoyait
   que `code`) — l'UI envoie les deux.
6. deep upload `url=None` : pièces privées par design (`.data/`, aucun S3).
7. xtreme mails introuvables : nommage `console_<hash24>` sans email —
   recherche par en-tête `To:`.
8. paranoid register dupliqué 409 : 400/409 acceptés (unicité OK).
9. paranoid proxy : liste des routes sensibles correcte.

**🔧 Harnais**
- `paranoid_sim.py` : `sh()` tolérant `TimeoutExpired` (cold compile login
  >10 s après restart Next) + timeouts 30-60 s.
- `run_all_sims.py` : `_run()` + `db_query()` 3 essais (PG occupé au stop
  de Next).
- `smoke.sh` : nettoyage réentrant (DELETE bookings `Smoke Test` + alertes
  sentinelles) — smoke 94/94 rejouable.
- deep en run solo → 429 : rate-limit mémoire documenté (le runner
  redémarre Next entre chaque simulation).

## Contraintes (inchangées)
- Additif : aucune migration de schéma, aucun changement de contrat API
  public, cas EUR numériquement identiques.
- Écarts invalidés documentés dans le rapport (guest mode, upload privé,
  rame-rate-limit mémoire).

## Étape suivante
À la demande (nouvel audit, nouvelle fonctionnalité…). Toutes les
simulations du runner unifié sont vertes.
