# 🎯 TÂCHE EN COURS

**Tâche :** T-148 — 23e audit fonctionnel profond : analyse à l'exécution
(pages, boutons, scénarios) des éléments inachevés/mal pensés, avec explication
et solution sans régression. Détail :
`REPORTS/audit_fonctionnel_profond23_2026-08-30.md`.

**Méthode :** DEV (3000), 3 rôles + anonyme. Environnement restauré (re-clone →
reset `ccfdea7`). Données de test nettoyées (chambre, wishlist, utilisateur
jetable anonymisé, réponse d'avis, vote utile, téléphone → état de seed,
8 utilisateurs actifs).

**Conclusion : aucune anomalie bloquante, aucun correctif de code nécessaire.**
Tous les scénarios testés sont corrects (validations + garde-fous d'autorisation).

## Scénarios profonds vérifiés SAINS

- Chambres hôte : création 201, prix négatif 400, client 403, désactivation →
  non réservable, garde propriétaire/admin.
- Avis : réponse hôte sur sa propriété 200 / client 403 / vide 400 ; vote
  « utile » anonyme 401, re-vote 409.
- Préférences : langue `ar` 400, devise inconnue 400, prénom vide/tél long 400.
- Réservation : capacité dépassée 409, départ<arrivée 400, passé 400,
  anonyme 401.
- **Sécurité** : auto-promotion `role:admin` ignorée (rôle reste customer) ;
  client/hôte sur routes admin 403 ; pages dashboard non autorisées → 307.
- Propriétés : hôte édite 200 mais statut/commission → 403 (admin only) ;
  client 403.
- Utilisateurs admin : suspension → login 401, réactivation OK, **auto-suspension 400**, non-admin 403.
- Favoris : ajout 201, doublon 400, propriété inexistante 404.
- Recherche : filtres équipements/capacité/type corrects, type invalide → 0 résultat.
- Dépôt d'avis : page `notFound()` si non propriétaire ou séjour non terminé.
- Pages : toutes les pages principales + dashboard hôte/admin répondent 200 ;
  paramètres admin (GET admin 200/client 403, PATCH clé invalide 404).
- Notifications : pas de centre générique (conception via messages/alertes/
  e-mails) ; aucun lien mort.

**ID** : T-148. **Niveau** : L. **Statut** : **AUDIT TERMINÉ — RAS (VALIDÉ)** — 2026-08-30.

## Sortie (validé — T-148)

- Aucun code modifié. 🧪 `tsc` 0 · `vitest` **288/288** · ▶️ `smoke` **94/94** ·
  `build` ✓ (**60 pages**) · `ai:check` **19 OK · 1 warn**.
- Rapport : `.ai/REPORTS/audit_fonctionnel_profond23_2026-08-30.md`.

---

## Avant : T-147 — 22e audit fonctionnel profond (messages FR routes 2FA)

## Avant : T-146 — 21e audit fonctionnel profond (récapitulatif rate plan)

## Avant : T-145 — implémentation des remarques produit (photo de profil,
## commission par hébergement admin, langue « ar ») — CORRIGÉ (VALIDÉ) 2026-08-29

- 🔨 Photo de profil : `POST /api/users/me/avatar` + bouton import dans
  `profile-form.tsx` (tous rôles, magic bytes, 5 Mo, rate-limit).
- 🔨 Carte « Commission plateforme » admin-only dans édition propriété ; envoyée
  au PUT seulement si admin (hôte 403).
- 🔨 Retrait de l'option langue « ar » (seules fr|en sont réelles).
- Sortie : `tsc` 0 · `eslint` 0 · `vitest` 288 · `smoke` 94/94 · build 59 pages
  · `ai:check` 19 OK / 1 warn. Rapport :
  `.ai/REPORTS/validation_T-145_2026-08-29.md`.
- Différé (ressources externes non simulables) : Stripe Connect / payouts et
  vraies clés carte — le code bascule dès que les clés sont fournies.
