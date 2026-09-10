# Analyse de conception — T-205 — Corrections runtime sans régression

- **Date** : 2026-09-09
- **Niveau** : S
- **Décision** : lots additifs, pas de migration, pas de refonte d’architecture, priorité aux gardes serveur déjà en place.

## Décisions de conception

### 1. Réservation : choix explicite plutôt que changement de défaut

- Le comportement actuel côté API (`payOnline` optionnel, manuel par défaut) est conservé.
- L’UI ajoute un sélecteur de mode :
  - **Demande avec paiement sur place** : n’envoie pas `payOnline`, reste `manualConfirmation:true`.
  - **Paiement en ligne sécurisé** : envoie `payOnline:true` et réutilise le flux Stripe/mock existant.
- Les libellés du bouton et du bloc de paiement sont dérivés du mode choisi.
- Le composant `shouldShowStripeForm` reste la garde de défense : même en cas de réponse serveur incohérente, une réservation manuelle n’affiche pas Stripe.

### 2. Disponibilité fiche et devis checkout : réutilisation du moteur métier pur

- La fiche publique utilise `evaluateBookingRules` pour un séjour valide issu de la query.
- Les règles prises en compte sont les mêmes que dans `POST /api/bookings` : capacité, `roomAvailability.availableCount`, `stopSell`, `minStay`, réservations non annulées chevauchantes.
- Une date passée est considérée invalide pour le contexte fiche : elle n’est plus propagée vers le checkout.
- L’alerte prix contextuelle reçoit un seuil par défaut basé sur le total réel du séjour quand celui-ci est calculable.
- Le tunnel appelle désormais `GET /api/bookings/quote` dès qu’une sélection est complète : le devis non persistant calcule les prix par nuit du calendrier, la remise rate plan, la TVA et BestRewards avec les mêmes règles que le POST.
- La progression et la soumission sont bloquées tant que le devis correspondant à la sélection courante n’est pas frais, afin d’éviter un prix affiché approximatif puis un montant serveur différent.

### 3. Validation hôte et bulk

- L’action unitaire `/api/properties/[id]/validate` possède déjà le gate hôte approuvé.
- Le bulk `properties/approve` doit appliquer la même règle par item, avec `skipped[]` explicite pour ne pas casser le contrat des actions groupées.
- L’UI de validation hôte affiche aussi le bouton d’approbation pour un hôte `rejected`, car l’API supporte déjà la transition `rejected → approved`.

### 4. Messagerie admin

- La page dashboard admin liste toutes les conversations, car le détail autorise déjà l’admin.
- L’API messages reconnaît l’admin comme participant support : il peut lire/écrire, mais aucun non-admin non-participant n’est ouvert.
- Les compteurs non-lus sont remis à zéro uniquement pour le destinataire réel (voyageur/hôte). Une lecture admin ne consomme pas les compteurs hôte.

### 5. Référentiels partagés

- `src/lib/property-types.ts` devient la source de vérité des types d’hébergement : tuple Zod/API, labels FR/EN, options UI.
- `src/lib/countries.ts` centralise les pays exposés par les formulaires.
- Les pages de recherche, création/édition propriété, réservation et profil consomment ces helpers.

### 6. Modération et audit

- Les prompts restent facultatifs pour ne pas bloquer les flows existants.
- Les motifs sont transmis uniquement pour les actions où ils ont du sens : rejet/suspension propriété, avis hidden/pending/rejected, suspension utilisateur.
- Les API stockent les motifs dans `audit_log.metadata`, sans ajout de colonne.

### 7. Chambres et calendrier

- Le bulk `rooms/delete` est transformé en soft-delete opérationnel (`isActive=false`, `updatedAt=now`).
- Les lignes availability/rate plans sont conservées pour pouvoir réactiver ou consulter l’historique.
- Le calendrier bloque localement reload/apply/save si la plage est invalide ou supérieure à la limite opérationnelle.
- L’API availability rejette aussi les plages mal formées, passées ou supérieures à 366 jours ; elle reste l’autorité si un client contourne l’UI.

## Alternatives écartées

- **Changer l’API pour rendre `payOnline` obligatoire** : rejeté, casserait les intégrations existantes et les tests T-202/T-203.
- **Ajouter des colonnes de motif** : rejeté pour T-205, l’audit log couvre la traçabilité sans migration.
- **Créer une messagerie admin séparée** : rejeté, le modèle conversation existant suffit et minimise la surface de régression.
- **Hard-delete conditionnel des chambres** : rejeté, l’objectif explicite est de conserver l’historique.

## Critères d’acceptation T-205

- Les parcours manuels existants restent fonctionnels.
- Le paiement en ligne est accessible explicitement depuis le tunnel.
- Les hébergements d’hôtes non approuvés ne peuvent pas être activés, y compris via bulk.
- Les statuts hôte sont visibles au compte et ré-approbables côté admin.
- La fiche n’envoie plus vers un checkout manifestement impossible pour dates passées/stock indisponible.
- Le récap checkout affiche un devis aligné sur les prix calendrier et la disponibilité serveur.
- Les dashboards restent multi-devises et la configuration payout reste visible à zéro revenu.
- Les motifs de modération/suspension sont audités.
- Tous les tests/gates demandés passent avant clôture.
