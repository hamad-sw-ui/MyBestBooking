# Débat technique multi-rôles — T-209

## Sujet

Implémenter les sept findings T-208 sans régression, avec migration bookings, sécurité démo, emails outbox et désactivation payout legacy.

## Architecte

- **Recommandation** : séparer strictement `requestExpiresAt` de `paymentExpiresAt`; garder les concepts paiement legacy et demande manuelle indépendants.
- **Objection** : multiplier les flags peut rendre le comportement peu lisible.
- **Alternative** : regrouper les flags dans une lib `feature-flags` documentée.

## Développeur Next.js senior

- **Recommandation** : limiter les changements UI à des conditions server/client simples; éviter une nouvelle page d'état vide.
- **Objection** : les variables `NEXT_PUBLIC_*` sont figées au build côté client; il faut le mentionner.
- **Alternative** : route `/api/features` dynamique, rejetée ici car surdimensionnée.

## Expert TypeScript

- **Recommandation** : exposer des helpers purs et testables pour TTL/flags; éviter les chaînes d'env dispersées.
- **Objection** : les routes existantes ont déjà beaucoup de logique; un helper mail dédié réduit le risque.

## Expert React RSC/Client

- **Recommandation** : `MaintenanceGate` doit rester fail-open; l'état d'erreur ne doit pas rediriger ni bloquer l'UI.
- **Objection** : un rendu visuel permanent pour un badge raté serait bruyant.
- **Décision proposée** : live-region sr-only uniquement en cas d'échec.

## Expert Drizzle / SQL

- **Recommandation** : migration additive nullable + index partiel éventuel pour l'expiration future.
- **Objection** : un `NOT NULL` exigerait backfill risqué.
- **Alternative** : table dédiée de holds, rejetée pour complexité.

## Expert PostgreSQL

- **Recommandation** : l'expiration cron doit filtrer `status='pending'`, `payment_intent_id IS NULL`, `payment_status='pending'`, `request_expires_at <= now()`.
- **Objection** : le timezone doit être géré par `timestamptz` (`timestamp with time zone`) déjà utilisé.

## Expert sécurité web

- **Recommandation** : masquer les credentials démo en UI ne suffit pas; refuser les emails démo en production hors opt-in serveur.
- **Objection** : ne pas ajouter de secret en dur ; les mots de passe existants restent des données de seed/dev.
- **Alternative** : supprimer comptes démo du seed, rejetée car cela casserait les validations/smoke de preview.

## Ingénieur QA

- **Recommandation** : ajouter tests ciblés pour les modes on/off des flags et pour l'expiration cron; réaligner dashboards_sim sur soft-delete.
- **Objection** : les tests legacy payout doivent être explicitement opt-in, sinon ils décrivent un comportement désactivé par défaut.

## DevOps / SRE

- **Recommandation** : `.env.example` documente flags off par défaut; `scripts/restore-env.sh` active seulement la preview locale.
- **Objection** : en prod, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` sans `DEMO_LOGIN_ENABLED=true` pourrait afficher l'UI mais refuser côté API si on ne synchronise pas. Décision : le serveur accepte aussi l'opt-in public explicite uniquement parce que le mot de passe reste requis; préférer `DEMO_LOGIN_ENABLED=true` en prod de démonstration.

## Expert UX / a11y

- **Recommandation** : email de demande créée doit expliquer clairement que la réservation n'est pas confirmée et que le règlement se fait hors plateforme selon consignes de l'hôte.
- **Objection** : ne pas donner de compte à rebours agressif si l'hôte peut renouveler ; afficher une date limite suffit.

## Relecteur adversarial

- **Risque soulevé** : désactiver payout POST peut masquer une régression des routes legacy.
- **Réponse** : tests legacy opt-in conservés + tests disabled par défaut ajoutés ; la fonctionnalité reste testable sans être active en production.
- **Risque soulevé** : les anciens `pending` sans `requestExpiresAt` restent indéfinis.
- **Réponse** : accepté pour compatibilité ; les nouvelles demandes sont bornées. Une migration de backfill serait un changement de données plus risqué et non demandé.

## Synthèse

Consensus : le TTL dédié et les flags serveur sont nécessaires. Les principaux désaccords portent sur la granularité des flags et le traitement des anciennes demandes pending. Décision : correction additive minimale, sans backfill destructif, avec comportements par défaut sûrs en production.

## Décision finale

- Retenir `requestExpiresAt` nullable + cron.
- Ajouter emails outbox demande créée.
- Flags démo off en production réelle, on explicite en sandbox.
- Payout mutable off par défaut, read-only conservé.
- QA réalignée sur contrats soft-delete/no-payment.
