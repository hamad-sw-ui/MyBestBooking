# Audit d'exécution — T-180 (cycle promotions + parcours « devenir hôte »)

- **Date** : 2026-09-02
- **Périmètre** : audit exécuté en **production locale** (process `next start`,
  build 60/60, PG embedded) — comportement réel, pas lecture de code.
- **Méthode** : scénarios bout-en-bout via `curl` authentifié (3 rôles +
  anonyme), inspection HTTP (statuts, corps, en-têtes), vérifications SQL de
  contrepartie (consommation promo, suspension effective, token consommé).

## Surface auditée et verdicts

| Zone | Scénario exécuté | Verdict |
|---|---|---|
| Promotions | Création admin `RENTREE2026` (−15 %, min 50) → simulation `apply` 400→340 ✅ · code inconnu 404 « Code inconnu » · sous-minimum 400 · insensible à la casse | SAIN |
| Promotions (réel) | Réservation réelle avec code → 201, `subtotal 356.01 / discount 108.67 / total 282.94`, statut `confirmed+paid`, `currentUses=1` consommé en base | SAIN |
| Facture | `GET /api/bookings/{id}/invoice` → 200 HTML (reçu) | SAIN |
| Facturation hôte | `GET /api/dashboard/billing/export` → 200 CSV | SAIN |
| Parrainage | Inscription avec `referralCode` (code `BANQ7…`) → filleul créé, lien enregistré | SAIN |
| Suspension | PATCH `/api/users/{id}/suspend` → toutes les requêtes du compte suspendu → 401 partout | SAIN |
| Fournisseurs | `GET /api/admin/providers` → statuts cohérents (stripe non configuré) | SAIN |
| Reset mot de passe | forgot → mail console → page 200 → reset 200 · ancien mdp 401 / nouveau 200 · **token à usage unique (2ᵉ reset = 400)** | SAIN |
| BestRewards / compte | Page 200 (Niveau 2), PATCH profil (country/phone) persisté | SAIN |
| Contact hôte | Anonyme → redirigé `/connexion?next=…` ; conversation via réservation → 201 | SAIN |
| Cycle propriété | Statut via **PUT** `/api/properties/[id]` (PATCH = 405) · hôte → 403 « réservé à l'administration » · admin passe en `draft` → sort de la recherche + fiche anonyme sert 404 · hôte garde sa vue · réactivation restaure tout | SAIN |
| **Devenir hôte** | Footer « Ajouter mon hébergement » → `/dashboard/properties/new` **pour tout le monde** : customer connecté → 307 → `/` (silencieux) ; anonyme → 307 → connexion → `/` ; le sélecteur de rôle de l'inscription n'était pas adressable en profondeur | **DÉFECTUEUX** |

## Défaut retenu (scene reproduite)

1. Voyageur connecté clique « Ajouter mon hébergement » (footer présent sur
   toutes les pages publiques).
2. Le proxy voit un rôle `customer` sur une route `/dashboard/*` → 307 `/`.
3. **Aucune explication** : l'utilisateur retombe sur l'accueil sans comprendre
   comment proposer son hébergement. Anonyme : aller-retour connexion→accueil
   tout aussi muet. Impasse de conversion mesurable.

Cause : le lien footer est une constante `/dashboard/properties/new` et ne
tient compte ni du rôle du visiteur ni de l'existence du parcours
d'inscription-hôte (sélecteur `isHost` pilotable uniquement par clic).

## Artefacts de test laissés en base (purgés à part)

- Promo `RENTREE2026` (`currentUses=1`), réservation promo payée.
- Comptes `filleul-26639@test.dev`, `suspend-19467@test.dev` (suspendu).
- Mot de passe `customer@mybestbooking.com` restauré à `Customer123!` après
  test du reset (poste de fumée conforme au seed).
