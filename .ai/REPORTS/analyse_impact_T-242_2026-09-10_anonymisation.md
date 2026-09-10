# Analyse d'impact — T-242 : anonymisation complète à la suppression de compte

- **Date** : 2026-09-10
- **Niveau de proportionnalité** : **C (critique)** — touche des **données personnelles persistées**
  (format stocké en base) et une promesse de conformité (page Confidentialité, § RGPD). Le niveau
  est volontairement le plus élevé des trois correctifs issus de l'analyse n°4 ; les règles
  d'arbitrage §15.0 imposent de choisir le plus haut en cas de doute.
- **Source** : `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (constat N1), copie
  `.ai/REPORTS/analyse_runtime_n4_2026-09-10_profondeur.md`.
- **Périmètre** : `DELETE /api/users/me` (`src/app/api/users/me/route.ts`), plus la tâche sœur
  T-243 (purge technique) qui partage la même revue.

## 1. Quels fichiers utilisent directement le composant concerné ?

```bash
grep -rn "users/me\"" src/components src/app --include=*.tsx | grep -c DELETE   # 1
# → src/components/delete-account-section.tsx:28  (fetch("/api/users/me", { method: "DELETE" }))
```

Aucun autre appelant : le seul déclencheur d'une anonymisation est le bouton « Supprimer mon
compte » de l'onglet Sécurité de `/mon-compte`.

## 2. Quels composants l'utilisent indirectement ?

Tout ce qui **relit** les données copiées ou journalisées :

| Consommateur | Dépendance | Effet de l'anonymisation |
| --- | --- | --- |
| `src/app/dashboard/page.tsx` (compteurs admin) | `bookings.guest_*` | inchangé (agrégats) |
| `src/lib/invoice.ts` / `GET /api/bookings/[id]/invoice` | `bookings.guest_first_name`, `guest_last_name`, `guest_email` | affichera « Supprimé Compte » — la facture reste émise, montants et référence intacts |
| `src/lib/mail/templates.ts` (gabarits voyageur) | `bookings.guest_email` | les envois postérieurs échouent proprement (adresse `@anonymized.local`) |
| `deliverEmail()` (`src/lib/email-outbox.ts`) | `email_outbox.to` | la livraison en cours reste possible ; l'historique n'expose plus l'adresse |
| `/dashboard/audit` (admin) | `audit_log.metadata` | la trace d'action subsiste, seule `targetEmail` est masquée |

## 3. Quels « ViewModel » (RSC → props clients) sont impactés ?

Aucun changement de props : l'anonymisation est une écriture serveur. Les RSC concernés
(`/mon-compte`, `/dashboard/users`, `/dashboard/audit`, `/mes-reservations`) n'ont pas de
signature modifiée.

## 4. Quels écrans sont impactés ?

- `/mon-compte` onglet Sécurité : le formulaire de suppression ne change pas (même endpoint,
  même confirmation).
- `/mes-reservations` et `/dashboard/bookings/[id]` : afficheront « Supprimé Compte » au lieu du nom
  d'origine pour les séjours antérieurs de l'utilisateur ayant exercé son droit — effet attendu.
- Factures PDF/HTML déjà générées et **conservées** : aucune rupture (elles sont recalculées à la
  demande depuis les mêmes colonnes, désormais neutralisées).

## 5. Quels workers / services sont impactés ?

`GET /api/cron/price-alerts` (rappels, expiration) : après anonymisation, les envois vers un
compte supprimé deviennent impossibles — c'est le comportement voulu. La purge T-243 s'ajoute au
même cron, sans nouvel ordonnanceur.

## 6. Quels tests existants couvrent déjà la fonctionnalité ?

```bash
grep -rln "anonymiz\|DELETE /api/users/me" src --include=*.test.ts   # → src/app/api/users/me/route.t206.test.ts
```

`route.t206.test.ts` vérifie le refus (409) quand une réservation est active. **Aucun** test ne
contrôle l'effet de l'anonymisation sur les tables secondaires : c'est exactement le trou qui a
laissé passer N1.

## 7. Quels nouveaux tests devront être créés ?

1. Test d'intégration `src/app/api/users/me/route.anonymisation.test.ts` :
   - crée un utilisateur + réservation + ligne outbox + entrée d'audit ;
   - appelle l'anonymisation (service extrait, sans HTTP si possible) ;
   - affirme : **0 occurrence** de l'adresse d'origine dans `users`, `bookings`, `email_outbox`,
     `audit_log` ; `booking.total`, `bookingReference`, `checkIn` inchangés ;
   - affirme que `GET /api/bookings/[id]/invoice` reste servable (200 pour l'hôte/admin).
2. Test unitaire de la fonction de purge T-243 (session expirée supprimée, session valide
   conservée, outbox `pending` jamais purgée).

## 8. Quels risques de régression existent ?

| Risque | Parade |
| --- | --- |
| Perte d'information comptable sur les factures | seuls `guest_*` sont neutralisés ; montants, référence, dates, commission et devise sont intacts ; testé |
| Envoi d'un e-mail à une adresse anonymisée (retry cron) | l'échec est déjà journalisé et borné par `MAX_ATTEMPTS` ; aucun envoi nouveau n'est créé pour un compte supprimé (le destinataire n'existe plus dans les requêtes métier) |
| Requête lourde sur `email_outbox` (mise à jour par adresse) | UPDATE unique indexé sur `to` (une adresse par compte) ; volume faible |
| Régression de la réponse HTTP du DELETE | contrat inchangé (`{ deleted: true }`, 200) ; seul l'effet interne s'étend |

## 9. Composants à revérifier après modification

`/mon-compte` (suppression), `/dashboard/users` (badge/état), `/dashboard/audit` (metadata),
`/mes-reservations` (affichage « Supprimé Compte »), `GET /api/bookings/[id]/invoice`,
cron `price-alerts` (aucune erreur), `npm run ci`.

## Conclusion

Impact circonscrit à une transaction serveur déjà existante, sans changement de contrat d'API ni
de schéma. Le risque majeur est **l'oubli d'une table secondaire** : la liste est établie au §2 et
couverte par le test d'intégration du §7.
