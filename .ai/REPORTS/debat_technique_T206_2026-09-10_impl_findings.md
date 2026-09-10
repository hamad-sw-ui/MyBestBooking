# Débat technique — T-206 — Implémentation des remarques de l'audit n°31

**Date** : 2026-09-10  
**Niveau** : C — débat obligatoire

---

## 1. Architecte

- **Recommandation** : centraliser les invariants (dates futures, publication active, cycle de vie paiement) plutôt que multiplier les conditions locales.
- **Objection** : un refactor complet booking/catalogue sur un gros diff T-205 non commit augmente le risque.
- **Alternative** : helpers ciblés maintenant, refactor domaine plus large plus tard.

## 2. Développeur Next.js senior

- **Recommandation** : limiter les changements RSC/Client aux props nécessaires (`maxChildren`, `min` dates) et garder les endpoints JSON stables.
- **Objection** : attention aux pages statiques si `new Date()` est utilisé ; ici les pages sont déjà dynamiques via auth/locale/DB.
- **Alternative** : passer `today` via helper serveur.

## 3. Expert TypeScript

- **Recommandation** : ne pas introduire de types génériques trop complexes ; préférer helpers purs simples et tests.
- **Objection** : Drizzle + `sql.raw` dans le catalogue peut devenir fragile.
- **Alternative** : aligner d'abord les paramètres API prouvés divergents, sans réécriture totale.

## 4. Expert PostgreSQL

- **Recommandation** : verrouiller la ligne promotion `FOR UPDATE` avant de décider `maxUses`.
- **Objection** : les requêtes catalogue corrélées doivent rester bornées ; pas de refactor SQL massif sans benchmark.
- **Alternative** : correction minimale de `amenity/amenities` + conversion prix + dates futures.

## 5. Expert Paiement

- **Recommandation** : aucune réservation ne doit être `completed` tant que `paymentStatus!='paid'`.
- **Objection** : le paiement manuel confirme la réservation avant paiement réel ; ne pas bloquer `pending→confirmed` dans ce cas.
- **Alternative** : autoriser confirmation manuelle uniquement si pas d'intent online, puis exiger `markPaidOffline` avant completion.

## 6. Expert Sécurité

- **Recommandation** : tous les UUID invalides doivent sortir avant DB ; maintenance doit bloquer les mutations non-admin.
- **Objection** : les endpoints auth/admin/cron/webhook doivent rester joignables pour anti-lockout et opérations.
- **Alternative** : `assertNotMaintenance(user)` sur mutations métier seulement.

## 7. Expert QA

- **Recommandation** : transformer les probes T-206 en tests ciblés, puis relancer `run_all_sims.py`.
- **Objection** : tant que `simulate.py` et `deep_sim.py` restent obsolètes, le runner complet ne peut pas redevenir vert.
- **Alternative** : corriger les harnais après les correctifs code pour valider le nouveau contrat.

## 8. Expert UX

- **Recommandation** : empêcher les dates passées dès les champs, borner les enfants avant checkout, masquer les conversations vides dans les listes.
- **Objection** : une conversation vide juste créée doit rester accessible après redirection.
- **Alternative** : ne pas supprimer les fils vides ; les exclure seulement des listes générales.

## 9. Expert Comptabilité

- **Recommandation** : ne pas appeler « facture » un document non payé.
- **Objection** : le bouton historique ne doit pas disparaître car il sert aussi de confirmation.
- **Alternative** : conserver endpoint/bouton, mais rendre le document unpaid comme reçu/confirmation non définitive.

## 10. Expert Support / Opérations

- **Recommandation** : bloquer suppression de compte avec obligations actives pour éviter biens vendables sans hôte et bookings sans contact.
- **Objection** : risque de frustration utilisateur RGPD.
- **Alternative** : retourner 409 explicite indiquant les obligations à résoudre, puis conserver l'anonymisation quand elles sont levées.

## Synthèse

Consensus sur la solution B : helpers ciblés + corrections locales testées. Désaccord rejeté : refactor complet du catalogue/booking dans ce tour, trop risqué sur une branche déjà lourde. Risque résiduel accepté : certaines dettes de centralisation resteront documentées, mais les invariants critiques seront protégés côté serveur.

## Décision finale

Implémenter les corrections T-206 sans migration DB, sans rupture de contrat existant et avec validations complètes. Les demandes invalides/dangereuses peuvent désormais recevoir 400/409/503 au lieu de 200/500 ; ce changement est volontaire et non régressif.
