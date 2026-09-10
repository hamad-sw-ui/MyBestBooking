# Validation T-209 — Implémentation des remarques T-208

Date : 2026-09-10  
Branche : `arena/01a08747-mybestbooking`  
Niveau : C

## Périmètre validé

- **F1 — TTL demandes manuelles** : `bookings.request_expires_at`, migration `0020`, helper TTL borné, création de réservation sans paiement avec `requestExpiresAt`, cron d'expiration conservateur (`pending` + `payment_status=pending` + `payment_intent_id IS NULL`) qui annule/libère promo/wallet et vide le TTL.
- **F2 — Emails demande créée** : outbox idempotente `booking-request:<id>:traveler|host`, templates FR/EN distincts des confirmations, envoi best-effort post-commit.
- **F3 — Login démo** : UI `/connexion` masquée hors flag public ; garde serveur stricte en production (`DEMO_LOGIN_ENABLED=true` obligatoire pour les comptes seed admin/host/customer).
- **F4 — Seed accueil/API** : bouton accueil vide masqué hors flag public ; `/api/seed` exige l'opt-in serveur en production en plus du `SEED_TOKEN` ADR-004.
- **F5 — Payout legacy** : lecture/export conservés ; POST host, configuration compte, cron payout et branche webhook payout neutralisés par défaut via `PLATFORM_PAYOUTS_ENABLED`.
- **F6 — QA dashboards** : `dashboards_sim.py` vérifie maintenant le soft-delete rooms (`is_active=false`) au lieu d'un hard-delete incompatible FK.
- **F7 — Fetchs silencieux** : observabilité console discrète et dédupliquée pour `maintenance-gate` et `unread-messages-badge`, sans blocage UX.

## Validations exécutées

| Commande | Résultat |
|---|---|
| `npm run env:restore` | ✅ dépendances installées, DB embarquée démarrée, `db:push` OK |
| Seed via `POST /api/seed` sous serveur dev | ✅ données démo créées |
| `npm run typecheck` | ✅ 0 erreur |
| Tests ciblés T-209 (`booking-request-expiration`, flags démo/payout, observabilité, booking, cron, payouts/webhook) | ✅ 10 fichiers / 43 tests passés |
| `npm run lint` | ✅ 0 erreur |
| `npm run test` | ✅ 99 fichiers passés / 2 skipped, 575 tests passés / 17 skipped |
| `npm run i18n:check` | ✅ 0 candidat |
| `npm run build` | ✅ build Next 16, 65 pages/routes générées |
| `npm run smoke` | ✅ 95/95 assertions (après correction du script pour relire `SEED_TOKEN` depuis `.env.local`) |
| `python3 scripts/dashboards_sim.py` | ✅ 68 OK / 0 WARN / 0 KO |
| `python3 scripts/run_all_sims.py` | ✅ 400 OK / 4 WARN / 0 KO |
| `npm run site:audit` | ✅ 269 pages visitées / 0 issue |
| `npm run ai:check` | ✅ 20 OK / 0 warn / 0 fail |
| `git diff --check` | ✅ aucun whitespace error |

## Note de validation

Un premier lancement de `npm run smoke` a échoué uniquement sur le seed en production preview : le serveur avait bien le `SEED_TOKEN`, mais le script smoke ne le sourçait pas depuis `.env.local`. Le harnais a été corrigé sans affaiblir la garde API : le seed reste protégé par opt-in serveur + token en production, et le smoke final passe à 95/95.

Un premier lancement de `python3 scripts/run_all_sims.py` a ensuite échoué avant scénario (`Next ne démarre pas`) parce que `.env.local` n'était pas présent/restauré dans le sandbox et que le runner n'était pas import-safe. Correctif QA : `run_all_sims.py` charge maintenant `.env.local` dans l'environnement des sous-process Next et protège sa séquence par `if __name__ == "__main__"`. Après `npm run env:restore`, la suite consolidée passe à 400 OK / 4 WARN / 0 KO.

## Conclusion

T-209 est validée sans réintroduire de paiement plateforme voyageur : le tunnel de réservation reste une demande manuelle (`payment:null`, aucun intent PSP), les expirations libèrent le stock par TTL métier, et les surfaces démo/payout sont opt-in ou non actionnables par défaut.
