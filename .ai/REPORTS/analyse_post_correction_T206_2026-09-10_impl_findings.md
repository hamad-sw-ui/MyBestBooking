# Analyse post-correction — T-206 — Findings runtime post T-205

Date : 2026-09-10  
Niveau : C  
Rapports amont :

- `.ai/REPORTS/audit_fonctionnel_profond31_T206_2026-09-09.md`
- `.ai/REPORTS/analyse_impact_T206_2026-09-10_impl_findings.md`
- `.ai/REPORTS/analyse_conception_T206_2026-09-10_impl_findings.md`
- `.ai/REPORTS/debat_technique_T206_2026-09-10_impl_findings.md`

## 1. Synthèse

Les 13 findings T-206 ont été traités par lots ciblés, conformément à la décision de conception : **helpers ciblés + centralisation progressive**, sans refactor global du catalogue ni du tunnel booking. Les correctifs conservent les contrats T-205 : paiement manuel par défaut, paiement en ligne explicite, devis serveur, wallet, disponibilité réelle, validation hôte, messagerie admin, payouts, soft-delete rooms, calendrier UI/API, avis approuvés et wishlists actives.

## 2. Contrôle par finding

| Finding | État | Correction appliquée | Risque résiduel |
|---|---|---|---|
| F1 — Finance quote/POST | Corrigé | `POST /api/bookings` additionne `ratePlanDiscount + promoDiscount`, n’applique plus BestRewards aux invités anonymes. Tests DB ajoutés. | Calcul toujours dupliqué entre quote et POST pour une partie du flow ; la correction reste bornée et testée. |
| F2 — Lifecycle paiement | Corrigé | Confirmation manuelle préservée si pas d’intent/TTL ; confirmation d’un checkout online unpaid refusée ; `completed` exige `paymentStatus="paid"`. | Aucun changement du cron : il exigeait déjà `paid`. |
| F3 — Publication hôte | Corrigé | `PUT /api/properties/[id]` applique `requireApprovedHost` avant `status:"active"`, comme `/validate`. | Publication admin de non-hôte reste autorisée via règle existante du helper. |
| F4 — Maintenance API | Corrigé | `assertNotMaintenance` ajouté aux mutations métier non-admin principales : properties, rooms, price-alerts, messages, conversations, wishlists, users/me. Probe price-alert → 503. | Les routes admin restent volontairement ouvertes anti-lockout. |
| F5 — UUID/searchParams | Corrigé | 400 explicites pour `propertyId` bookings/rooms, messages `conversationId`, DELETE properties/rooms, wishlists query params. | Extension possible à de futures routes si ajoutées. |
| F6 — Dates passées recherche | Corrigé | Helper `future-stay`; `/api/properties` et `/recherche` retournent 0 résultat si séjour demandé impossible ; inputs date bornés. | Sans dates, comportement catalogue historique conservé. |
| F7 — Divergence SSR/API catalogue | Corrigé | API accepte `amenity` singulier, cherche dans `properties.amenities` et `rooms.amenities`, convertit les bornes `displayCurrency`. | Le moteur n’est pas encore entièrement partagé ; les écarts ciblés sont fermés. |
| F8 — Enfants fiche | Corrigé | `PropertyBookingCard` reçoit `maxChildren` et borne les options enfants selon chambre + occupation. | Le serveur reste l’autorité finale. |
| F9 — Messagerie | Corrigé | Listes masquent les fils sans message ; admin voit `/dashboard/messages`; API conversations inclut admin et masque les fils vides en GET. | Le fil direct créé reste accessible, comme prévu par la solution minimale. |
| F10 — Suppression compte | Corrigé | `DELETE /api/users/me` bloque si booking actif ou propriété hôte non archivée ; anonymisation RGPD conservée après résolution. | Pas de workflow transfert hôte complet dans ce lot ; blocage explicite. |
| F11 — Facture/reçu unpaid | Corrigé | Bouton document visible seulement si `paymentStatus="paid"`; `buildInvoiceData` ne produit une facture que si légal + paid ; note unpaid dédiée. | Les anciens liens directs restent servis en reçu non payé, pas en facture. |
| F12 — Promo concurrency | Corrigé | Lecture promo `FOR UPDATE` dans la transaction avant `isPromoUsable`, puis incrément dans la même transaction. | Test concurrent massif non ajouté ; verrou validé par type/build + test consommation unitaire. |
| F13 — Harnais QA | Corrigé | `simulate.py` attend `pending/manualConfirmation`; `deep_sim.py` lit `account-client.tsx`; `paranoid_sim.py` intègre F10. Runner 5/5 vert. | WARN existants de deep/xtreme sans KO conservés. |

## 3. Non-régression vérifiée

- Le paiement manuel reste le défaut (`POST /api/bookings` → `pending`, `payment:null`, `manualConfirmation:true`).
- La confirmation hôte d’une demande manuelle reste possible sans exiger le paiement immédiat.
- La clôture/loyalty ne s’active plus sur unpaid.
- Le flux online reste distinct : un intent PSP pending ne peut pas être confirmé manuellement comme payé.
- Les routes publiques de catalogue restent accessibles sans session et conservent le cache public.
- Les routes admin anti-lockout restent disponibles pendant maintenance.
- Le rendu facture payé/legal reste inchangé (`INVOICE` / filename invoice), seul unpaid est déclassé en reçu.

## 4. Écarts acceptés

- Le moteur quote/POST n’a pas été entièrement refactoré en une seule fonction pure afin d’éviter un refactor transversal risqué dans ce lot. Le défaut F1 réel est corrigé et couvert par test.
- Les warnings des simulations deep/xtreme ne sont pas des KO bloquants et étaient déjà tolérés par le runner ; ils ne correspondent pas aux findings T-206 corrigés.
- `npm ci` signale 8 vulnérabilités npm existantes ; elles ne sont pas dans le périmètre T-206 et n’ont pas été traitées pour éviter un upgrade destructif.

## 5. Résultat

T-206 est considéré **corrigé et validé** : tests unitaires/intégration, build, smoke, site-audit, simulations et garde `.ai` sont verts après mise à jour documentaire finale.
