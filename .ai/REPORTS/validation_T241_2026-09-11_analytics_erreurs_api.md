# Validation — T-241 (audit n°3 : F11 + F12 + F13)

- **Date** : 2026-09-11
- **Statut** : **CORRIGÉ (VALIDÉ)**
- **Rapports** : `analyse_impact_T241_2026-09-11_analytics_erreurs_api.md` ·
  `analyse_conception_T241_2026-09-11_analytics_erreurs_api.md`

## 1. Gates (`npm run ci`, exit code 0)

| Étape | Résultat |
|---|---|
| Typecheck | **0 erreur** |
| Lint | **0 erreur / 0 warning** |
| i18n | 0 candidat introduit (verrou `ui-strings` **1682** clés FR = EN) |
| Vitest | **129 fichiers / 743 tests** ✅ (+2 fichiers, +8 tests) |
| Build | ✅ |
| Smoke | **95/95** ✅ |
| `ai:check` | 19 OK · 1 warn (R7 `STATE.md`, resync en fin de session) · 0 fail |

## 2. Preuves runtime

### (b) Export CSV et sélecteur de période

```
login hôte=200
GET /api/dashboard/analytics/export                              → 200 text/csv
  "Résumé"
  "Indicateur","Période","Période précédente","Devise"
  "Revenus encaissés","23159.45","0.00","EUR"
  "Réservations","35","0",""
  "Taux d'occupation","0.60 %","",""
  "Période","2026-08-13 → 2026-09-11","2026-07-14 → 2026-08-12",""
  "Jours","30","30",""
GET /api/dashboard/analytics/export?from=2026-01-01&to=2026-06-30 → 200 (46 lignes)
GET …/export?from=2026-06-30&to=2026-01-01                          → 400 « Période invalide … »
GET …/export (sans session)                                         → 403
GET /dashboard/analytics?from=2026-06-01&to=2026-06-30              → 200
  « Période analysée : du 1 juin 2026 au 30 juin 2026 (30 jours) — comparaison … »
GET /dashboard/analytics (défaut)                                   → 200
  « Période analysée : du 13 août 2026 au 11 septembre 2026 (30 jours) … »
```

Le défaut est **exactement** la fenêtre historique : la page sans paramètre affiche la même
période que le cron d'avant T-241.

### (c) Erreurs d'API

Test d'intégration (3/3) sur la vraie route :

- `PUT /api/bookings/[id]` avec `{ "paymentStatus": "paid" }` → **400**,
  `issues: [{ field: "paymentStatus", message: "Champ inconnu : paymentStatus" }]`
  (avant : 200 silencieux, statut de paiement inchangé) ;
- `{ status: "pas-un-statut", cancellationReason: 12345 }` → **400** avec **deux** issues, libellés
  français (aucun `Invalid`/`Expected`/`Required`/`Unrecognized`) ;
- `{ status: "cancelled", cancellationReason: "Test T-241" }` → **404** (corps accepté, aucune
  écriture : la validation précède la lecture métier).

Route settings (test réécrit) : `PATCH /api/admin/settings/[key]` invalide → 400 avec `error` **et**
`issues` traduits, sans `path` ni `unrecognized_keys` sérialisés.

### (a) « Supprimé » vs « suspendu »

Déjà livré par T-230, **vérifié** : `users.suspended_at` et `users.deleted_at` sont deux colonnes
distinctes, `users-manager.tsx` dérive les deux états, `UserSuspendActions` affiche
« Compte anonymisé — non réactivable » (`bulk.deletedNoReactivate`, FR + EN) au lieu du bouton
**Réactiver**. Aucun code ajouté — conforme à la note d'audit « à fusionner avec T-230 ».

## 3. Base après validation

Seed régénéré pour la session : **8 users / 8 annonces / 35 réservations / 26 avis**, aucun compte
suspendu ou supprimé, aucune sonde résiduelle.

## 4. Reste

- Resynchronisation de `.ai/STATE.md` sur le HEAD final (R7).
