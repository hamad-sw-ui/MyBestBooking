# Débat technique — audit n°8, niveaux C (T-273 remboursement manuel, T-275 renvoi claim)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Périmètre** : les deux tâches de niveau **C** de l'implémentation de
  l'audit n°8 (§15.2 — obligatoire pour tout niveau C).
- **Documents d'entrée** : `analyse_impact_T271_T275_2026-09-11_audit8.md`,
  `analyse_conception_T271_T275_2026-09-11_audit8.md`.
- **Rappels de règle** : les avis sont hétérogènes par construction ; une
  objection est une hypothèse — toute objection devenant un item `BUGS.md`
  doit être vérifiée dans le code (com mande à l'appui).

## Rôles

| # | Rôle | Intérêt structurel |
|---|---|---|
| 1 | Architecte | cohérence des frontières (FSM vs sous-états, routes dédiées) |
| 2 | Dev senior (Next.js/Drizzle) | livrabilité, patterns house |
| 3 | Expert données (Postgres/Drizzle) | intégrité transactionnelle, locks |
| 4 | Expert sécurité | surface publique, tokens, énumération |
| 5 | Expert QA | testabilité, non-régression |
| 6 | Expert performance | coût des requêtes, latence |
| 7 | Expert DevOps | exploitabilité, réglages, outbox |
| 8 | Expert produit | parcours utilisateur, promesses |
| 9 | Expert finance | état comptable, double refund |
| 10 | Relecteur | honnêteté du diff, dette |

---

## T-273 — finalisation du remboursement hors plateforme

**1. Architecte** — *Recommandation* : route dédiée `POST /api/bookings/[id]/refund`,
sous-état orthogonal à la FSM (le refund ne doit pas entrer dans
`transitionError` : un `no_show` peut être remboursé manuellement aussi bien
qu'un `cancelled`, et un `completed` jamais — l'orthogonalité statut × refund
existe déjà dans le schéma). *Objection* : deux « mondes » d'écriture sur
`refund_status` (webhook Stripe + route hôte) — faut-il un helper partagé
`applyRefund(tx, booking, { source })` ? *Risque* : dérive sémantique si les
deux chemins divergent. *Alternative* : champ `finalizeRefund` dans `PUT`
(conçu puis écarté — la route porte déjà 5 comportements).

**2. Dev senior** — *Recommandation* : suivre le pattern `markPaidOffline`
(garde hôte/admin, idempotence explicite, `recordAudit`) — c'est le jumeau
exact (acte money hôte, pas de PSP). *Objection* : le bouton dans
`BookingRowActions` ajoute un 5e état conditionnel — le composant devient
illisible. *Risque* : UI. *Alternative* : badge-only dans la fiche
`/dashboard/bookings/[id]` (moins visible, moins d'UI) — le constat F3 porte
sur l'absence d'**action**, pas d'emplacement : je recommande la liste.

**3. Expert données** — *Recommandation* : transaction `FOR UPDATE` sur le
booking + prédicat d'état **dans le SET** (update conditionnel, pas lecture
puis écriture) — deux finalisations concurrentes ne peuvent pas toutes passer
(le 2e update n'affecte 0 ligne → 409). *Objection* : `paymentIntentId IS
NULL` est-il suffisant pour exclure la voie PSP ? Un booking payé en ligne
porte **toujours** son `paymentIntentId` (T-207 n'efface l'intent qu'à la
confirmation manuelle d'une demande — et une demande manuelle n'est jamais
`paid` via PSP). Vérifié dans le code : `payment-intents.ts` et
`booking-events` posent `paymentIntentId` à toute capture PSP. *Risque* :
**vérifié, pas d'écart** — mais je demande un test (h) dédié (impact
§ T-273.7) pour verrouiller l'hypothèse. *Alternative* : rien.

**4. Expert sécurité** — *Objection* : une route hôte qui écrit un état
financier, c'est une cible de replay/abuser (hôte malveillant = son propre
état comptable ; admin = plus grave). *Recommandation* : RBAC strict
hôte-du-bien/admin (jamais le voyageur, jamais un tiers — 403), audit log
avec `actorId` + `actorRole`, **pas** de motif libre dans le corps (pas de
champ texte user → rien à injecter, rien à modérer). *Risque* : résiduel
faible. *Alternative* : confirmation par 2e facteur hôte — disproportionnée
pour un acte que l'hôte peut déjà faire via annulation (T-156).

**5. Expert QA** — *Recommandation* : 8 cas (impact § T-273.7) dont l'idempotence
409 et le 409 PSP. *Objection* : l'e-mail de finalisation — si le gabarit est
customisable admin (`emailTemplates`), un template cassé ne doit pas bloquer
l'acte : l'envoi est best-effort post-commit, comme la confirmation (T-203).
*Risque* : e-mail perdu sans trace → la trace est l'audit (suffisant, le
refund est déjà posé). *Alternative* : rien.

**6. Expert performance** — *Objection* : une route de plus = un endpoint à
surveiller. *Recommandation* : négligeable (1 `FOR UPDATE` par acte money
rare) ; le rate-limit `rateLimit(booking:refund:<id>)` n'est **pas** requis
(idempotent 409, pas d'I/O coûteux, RBAC d'abord) — je m'y oppose pour éviter
le bruit 429 sur un double-clic hôte légitime. *Risque* : n/a.

**7. Expert DevOps** — *Recommandation* : l'acte est irréversible — le doc
op (`KNOWN_LIMITATIONS.md`) doit dire que le retour arrière est un ajustement
admin **tracé**, pas un bouton. *Objection* : l'e-mail voyageur est un nouvel
interrupteur ? Non : je refuse d'ajouter `notifications.refundFinalized` —
l'acte de refund est un e-mail transactionnel (comme la confirmation de
remboursement d'annulation T-266) : pas d'interrupteur supplémentaire,
meilleur ratio réglage/complexité. Le DevOps accepte : l'outbox retry couvre
les pannes. *Risque* : volume négligeable.

**8. Expert produit** — *Recommandation* : le bouton s'appelle « Finaliser le
remboursement » avec confirmation **motif obligatoire** (`ReasonDialog`
T-247 — le motif va dans l'audit log, pas en colonnes). *Objection* : et le
label client « à traiter par l'hébergeur » (T-266) ? Il doit devenir
« Remboursé » automatiquement — vérifié : `mes-reservations` lit déjà
`refundStatus` et les clés `host.refunded`/`bookings.refundManual` existent ;
aucun code client n'est requis. *Risque* : n/a.

**9. Expert finance** — *Objection (la plus grave du débat)* : `refundAmount`
— à combien ? Le booking peut avoir un `cancellationFee` (annulation payante)
: le remboursement effectif = `total` − `cancellationFee`. Mais le cas
`refundStatus='pending'` (déjà annulé, refund en cours) est **exclu** (409) —
donc la finalisation ne concerne que `refundStatus='none'` : est-ce possible
sur un booking payé ? Oui : paiement sur place jamais annulé, l'hôte rembourse
directement le client (annulation « à l'amiable » hors système) →
`refundAmount` = `total` (pas de `cancementFee` posé). *Recommandation* :
`refundAmount = total` **seulement si `refundStatus='none'`** (garde existante),
jamais de recalcul ; si un jour un état `pending` doit être finalisable, c'est
un sujet nouveau (le 409 l'empêche de dévier). *Risque résiduel accepté* :
l'acte pose un état comptable sur foi de l'hôte (contrat de confiance
identique à `markPaidOffline` — l'hôte atteste un fait externe). *Qui accepte* :
produit + finance, documenté.

**10. Relecteur** — *Vérifications à l'appui* : (a) `grep refundStatus
src/app/api --include=route.ts` = vide (confirmé avant le débat — la route
n'existe pas) ; (b) schéma : `refund_status`/`refunded_at`/`refund_amount`
existent (aucune migration) ; (c) `payment-events.ts` est le seul émetteur
`refunded` (confirmé). *Objection* : le diff doit rester lisible — pas de
refactor en passant. *Risque* : n/a.

### Synthèse T-273
- **Retenu** : route dédiée (unanim), gardes dans le SQL conditionnel
  (données), `FOR UPDATE`, audit + motif `ReasonDialog` (produit/dév),
  `refundAmount = total` sous la garde `none` (finance), e-mail best-effort
  sans interrupteur (DevOps/produit), pas de rate-limit route (performance —
  le 409 idempotent suffit), RBAC hôte/admin (sécurité).
- **Écarté** : champ `finalizeRefund` dans `PUT` (architecte/Dev : surcharge
  de la route), 2FA hôte (sécurité, disproportionné), interrupteur d'e-mail
  dédié (DevOps).
- **Risques résiduels acceptés** : confiance hôte sur l'acte (produit +
  finance) ; e-mail sans interrupteur (DevOps) ; irréversibilité sans bouton
  retour (produit, doc `KNOWN_LIMITATIONS.md`).

---

## T-275 — renvoi du claim invité

**1. Architecte** — *Recommandation* : route publique **autonome**
(`POST /api/auth/resend-guest-claim`), pas de surcharge de
`reset-password` (qui consomme un token — sémantique opposée : ici on **émet**).
*Objection* : une route publique qui lit `bookings` par référence → index
existant ? Vérifié : `bookings.booking_reference` est `unique` (schéma
`unique()`) → la lecture est O(1). *Risque* : n/a. *Alternative* : sous-route
`/api/bookings/[id]/resend-claim` — écarté : l'id du booking est un UUID
intime (l'invité n'en a pas, seulement la référence) et la sémantique est
**authentique** (auth/), pas métier.

**2. Dev senior** — *Recommandation* : copier le squelette de
`resend-verification` (rate-limit, réponse générique, best-effort mail) —
pattern house. *Objection* : l'UI — le bouton vit sur l'écran de confirmation
du tunnel (état 4) où `guestEmail` + référence sont en main ; pas de nouvelle
page. *Risque* : n/a.

**3. Expert données** — *Recommandation* : les 4 gardes (pending, email exact,
`passwordHash IS NULL`, `deletedAt IS NULL`) en **une** requête jointe
`bookings ⋈ users` ; pas de transaction nécessaire (pas d'écriture avant
l'émission ; le jeton est inséré après, hors race — deux renvois concurrents
émettent 2 jetons, le premier consommé tue le 2e : `consumeToken` atomique,
déjà testé). *Objection* : faut-il invalider le jeton **précédent** au
renvoi ? Non (débat ci-dessous, sécurité + produit). *Risque* : faible.

**4. Expert sécurité** — *Objection (principale)* : un endpoint public qui
déclenche des e-mails = vecteur de **spam de victimes** (« renvoyez le claim
à la victime X ») et d'**énumération de références**. *Recommandations* :
(i) réponse **strictement générique** dans tous les cas — aucune divergence
statut/message/latence visible ; (ii) double identification : référence **et**
email exact (l'attaquant qui a la référence n'a pas l'email — l'email est
dans l'e-mail que l'attaquant n'a pas lu ; l'attaquant qui a l'email ne devine
pas la référence 8 chars parmi l'espace MBB-2026-XXXXXX) ; (iii) rate-limit
**email 3/h** (borne spam-victime : 3 e-mails/h max pour un compte) et
**IP 10/h** (borne brute-force) ; (iv) le renvoi n'annule pas le jeton en
cours (pas de race « lien mort ») ; (v) jamais de jeton en réponse.
*Risque résiduel* : un hôte malveillant pourrait demander le renvoi pour des
invités qu'il a invités… le destinataire est **l'email de l'invitation
elle-même** (le `guestEmail` du booking), pas l'attaquant — aucun détournement
vers une 3e boîte. Acceptable. *Alternative* : renvoi uniquement via un lien
dans l'e-mail initial — écarté (cas e-mail perdu).

**5. Expert QA** — *Recommandation* : les 7 cas (impact § T-275.7) + le test
critique de non-régression : **le lien initial reste consommable après un
renvoi** (2 jetons `guest_claim` en base, le premier consommé → le 2e
consommable). *Objection* : la page `/activer-compte` avec un lien expiré
affiche « lien invalide » — ajouter une mention « renvoyez depuis votre
confirmation » ? Non : le bouton est sur l'écran de confirmation, pas sur
l'erreur (l'erreur n'a pas de contexte guestEmail fiable). *Risque* : n/a.

**6. Expert performance** — *Objection* : négligeable (1 requête jointe +
1 insert jeton + 1 outbox) ; le coût spam est borné par le rate-limit (3/h).
*Recommandation* : aucun cache (données sensibles, jamais cachées).

**7. Expert DevOps** — *Recommandation* : l'eventKey `guest-claim-resend:<id>:<ts>`
permet plusieurs renvois (contrairement à l'initiale idempotente
`guest-claim:<id>`) — vérifié le pattern `email-verification-resend:<id>:<ts>`
(`resend-verification/route.ts`) : c'est le pattern house. *Objection* : la
rétention outbox (T-243) purge les lignes terminales — aucun risque de fuite
des jetons en base (jeton en `verification_tokens`, expirant 24 h, purgé par
le TTL existant). *Risque* : n/a.

**8. Expert produit** — *Recommandation* : bouton discret « Renvoyer l'e-mail
d'activation » sous le texte « un e-mail vient de vous être envoyé » — visible
seulement en guest (`guestAccessPending`), avec état « ✅ Renvoyé (vérifiez
vos spams) ». *Objection* : ne pas le proposer après claim (le compte est
activé — le bouton disparaît de facto puisque l'état 4 n'est plus revu, mais
la route le refuse aussi : garde `passwordHash IS NULL`). *Risque* : n/a.

**9. Expert finance** — *Objection* : aucune incidence (pas d'argent) ; je
signale juste que le booking reste `pending` et expire à `requestExpiresAt`
(24 h par défaut) — le renvoi ne **prolonge pas** la demande. C'est cohérent
(une 2e chance sur l'e-mail, pas sur le TTL) mais le doc doit le dire.
*Recommandation* : mention dans le rapport de validation.

**10. Relecteur** — *Vérifications* : (a) `bookings.booking_reference`
`unique` (schéma) ; (b) `verification_tokens` existe avec purpose
`guest_claim` (T-109) ; (c) `consumeToken` atomique (tokens.ts:52-72) ;
(d) `resend-verification` ne traite que `email_verification` + auth
(confirmé). *Objection* : le diff UI doit rester conditionnel
(`guestAccessPending`) — jamais visible au voyageur connecté. *Risque* : n/a.

### Synthèse T-275
- **Retenu** : route autonome auth/ (architecte), 4 gardes en 1 requête
  (données), réponse générique + double identification + rate-limit double
  (sécurité), 2 jetons coexistant sans invalidation (sécurité/produit),
  eventKey timestampé (DevOps), bouton conditionnel sur l'état 4 (produit).
- **Écarté** : sous-route bookings/ (architecte), lien de renvoi dans
  l'e-mail (sécurité : ne couvre pas le cas perdu), invalidation du jeton
  précédent (QA : race « lien mort »), prolongation du TTL (finance/produit).
- **Risques résiduels acceptés** : spam de victimes borné à 3/h (sécurité +
  produit) ; coexistence de jetons (QA, bornée 24 h + usage unique).

---

## Décision finale

Les deux conceptions sont approuvées **avec les garde-fous retenus** ci-dessus.
Aucune objection ouverte ne devient item `BUGS.md` (les hypothèses ont été
vérifiées : index unique `booking_reference` présent, `paymentIntentId` toujours
posé par la voie PSP, `consumeToken` atomique). L'implémentation suit le plan
de développement de `analyse_conception_T271_T275_2026-09-11_audit8.md`.
