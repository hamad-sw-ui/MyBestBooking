# Analyse d'impact — T-263 (B10 : résidus T-207) et T-264 (B12 : rate-limit en mémoire)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **BASE** : `7e71914`
- **Niveau** : **S** (récapitulatif documentaire + un log unique ; aucune route supprimée, aucun
  contrat modifié).
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` § 3.10 (B10)
  et § 3.12 (B12)
- **Rapport de validation** : `.ai/REPORTS/validation_T263_T264_2026-09-11_audit6_B10_B12.md`

## 1. Surfaces touchées

| Fichier | Nature | Rôle |
|---|---|---|
| `.ai/KNOWN_LIMITATIONS.md` | complété (déjà présent depuis `11165d4`) | entrée « Dette T-207 » : résidus, conditions de retrait, colonnes à ne pas nettoyer |
| `docs/CI.md` | complété (ligne déjà présente) | checklist de mise en production : rate-limit en mémoire → Redis au-delà d'une instance |
| `src/app/(main)/reservation/reservation-form.tsx` | modifié | marqueur `// legacy:` sur la lecture `propertyId`/`roomId` |
| `src/app/dashboard/rooms/[id]/page.tsx` | modifié | marqueur `// legacy:` sur la redirection de compatibilité |
| `src/lib/rate-limit.ts` | modifié | avertissement **unique** en production sans `REDIS_URL` (log seul) |
| `src/lib/rate-limit.test.ts` | modifié | vérifie l'unicité de l'avertissement |

## 2. Effets indirects

1. **Aucune route supprimée** : `POST /api/bookings/[id]/payment` et `/api/cron/payouts` continuent de
   répondre **410 explicite** aux vieux liens (une page morte serait une régression) ; le stub
   `GET /api/providers/stripe` ne divulgue toujours aucune clé.
2. **Colonnes conservées** : `bookings.paymentMethodOffline`, `paymentIntentId`, `paymentExpiresAt`
   restent lues et écrites (le tunnel manuel en dépend) — la dette est récapitulée, pas nettoyée.
3. **Avertissement rate-limit** : émis **une seule fois par processus**, uniquement si
   `NODE_ENV === "production"` **et** `REDIS_URL` absent ; aucun effet sur le comportement, les
   tests tournent en `NODE_ENV=test` (aucun spam de logs).
4. **Comportement des limites inchangé** : la fenêtre glissante en mémoire reste la seule
   implémentation ; la décision de basculer sur un stockage partagé reste produit (documentée).

## 3. Risques de régression et traitement

| Risque | Traitement |
|---|---|
| Le marqueur `// legacy:` casse du code | Commentaires uniquement, aucun changement fonctionnel |
| L'avertissement pollue les logs/tests | Unique, conditionnel à la production, testé (`vi.stubEnv`) |
| Un lecteur croit que les routes 410 sont des oublis | `KNOWN_LIMITATIONS.md` dit explicitement pourquoi elles restent (liens anciens) et quand les retirer |

## 4. Revérification

`tsc` 0 · `eslint` 0/0 · `rate-limit.test.ts` **11/11** (avertissement unique compris) · vitest
complet dans la foulée · aucune clé i18n ajoutée (verrou 1749 inchangé).
