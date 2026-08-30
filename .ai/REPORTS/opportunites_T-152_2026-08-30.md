# Opportunités — T-152 (audit n°24, implémentation A→E + G)

- **Sujet** : correctifs d'affichage/UX suite à l'audit fonctionnel n°24
  (pending payer/annuler, devise réelle, totaux par devise, sélecteur de
  langue, état avis, smoke auto-suffisant).
- **Règle** : aucune opportunité de cette liste n'est implémentée dans
  T-152 ; elles sont proposées pour arbitrage ultérieur (backlog).

| # | Opportunité (axe) | Gain estimé | Coût | Priorité | Risque |
|---|---|---|---|---|---|
| 1 | (UX/i18n) Migrer les 93 composants restants vers `makeT` par grappes de pages (bestrewards, aide, messages, dashboard) | Interface réellement bilingue (promesse produit) | M-L | 🟠 P2 | Faible (défaut fr) |
| 2 | (Simplicité) Centraliser les sélecteurs de langue (header + profil) dans un composant unique `LanguageField` | Une seule logique de persistance, moins de divergence | S | 🟢 | Faible |
| 3 | (Testabilité) Importer le contrat `GET /api/bookings` dans un schéma zod partagé et tester le payload complet | Détection immédiate de régressions de forme d'API | M | 🟠 P2 | Faible |
| 4 | (Maintenabilité) Remplacer les séries de `reduce(parseFloat(total))` par un agrégat SQL `GROUP BY currency` dans analytics/billing | Une requête, zéro parsing client, coût O(1) DB | S-M | 🟢 | Moyen (SQL) |
| 5 | (Fiabilité smoke) Nettoyage automatique des résidus créés par le smoke (bookings/wishlist-items/price-alerts/outbox) | Base toujours propre après chaque run, zéro manipulation manuelle | S | 🟠 P2 | Faible |
| 6 | (UX) Notifier par e-mail « paiement en attente » à J-1 avant expiration de l'intent | Moins de réservations perdues, reprise proactive | S | 🟢 | Faible |
| 7 | (Architecture) `formatPrice` avec locale dynamique (`fr-FR`/`en`) | États des prix cohérents avec la langue | S | 🟢 | Faible |
| 8 | (Sécurité/UX) Anti-doublon d'avis déjà couvert par l'API : ajouter l'état au **dashboard hôte** (historique des résa commentées) | Cohérence hôte/voyageur | XS | 🟢 | Faible |

**Ne pas faire maintenant** : conversion transactionnelle multi-devises
(Stripe ne supporte pas XAF — contrainte T-132) ; traduction de l'arabe
(dictionnaire RTL absent) ; refonte du chart analytics (bénéfice marginal
devant la note explicite de devise).
