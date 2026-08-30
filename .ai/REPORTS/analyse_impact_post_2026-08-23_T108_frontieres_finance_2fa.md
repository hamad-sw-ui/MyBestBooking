# Analyse d’impact post-correction — T-108

## Livré

| Audit | Correction livrée |
|---|---|
| AUD-108-01/03/18 | DTO `PublicProperty`/`PublicPropertyCard`, wrapper Server Component avant client Flight, detail API/page active-only public, statut PATCH réservé admin, room detail cohérent. |
| AUD-108-02 | `GET /api/reviews` force approved au public; statuts modérés sont restreints admin/hôte propriétaire. Pagination validée. |
| AUD-108-04 | `cancelBooking()` partagé par route individuelle et bulk : frais snapshotés, refund/cancel PSP hors transaction, benefits et outbox annulation. |
| AUD-108-05 | `delete` bulk property est devenu archivage transactionnel non destructif; rooms/rate plans/bookings restent auditables. UI nomme désormais l’action Archiver. |
| AUD-108-20 | helper d’agrégats reviews partagé par create/moderate/bulk delete/bulk statut. |
| AUD-108-06 | pending secret TOTP additive, password + TOTP actif exigés, aucun QR externe, promotion du secret seulement au verify. |

## Contrôles runtime

- property publique API : aucune des clés `hostId`, `commissionRate`, `validatedBy`;
- draft API 404 et rendu Next not-found sans titre draft;
- host PATCH status 403; review hidden anonyme absente;
- fixture capacité/prix contradictoire absente de recherche et payload RSC sans clés privées;
- bulk booking payé : cancelled/paid/refunded, raison administrative et outbox sent;
- bulk property : archived, room/rate plan conservés; bulk review : agrégat 0/0;
- 2FA : setup password, secret local sans `otpauth`, remplacement exige code actif et conserve actif avant verify, disable password+TOTP.

## Limites restantes hors T-108

- T-109 : claim invité, reprise Stripe UI, globalisation complète outbox, fuseau/devise;
- les settings notifications et certains settings sécurité non consommés restent documentés dans BUG-037/T-109;
- provider réel et E2E Chromium non validés dans sandbox.
