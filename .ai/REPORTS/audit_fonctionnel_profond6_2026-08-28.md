# Audit fonctionnel profond n°6 — parcours secondaires, finance & durcissement

- **Date** : 2026-08-28
- **Branche** : `arena/01a042cf-mybestbooking` (T-125 poussée incluse)
- **Méthode** : exécution réelle (Next 16.2.6 + Postgres), 3 rôles connectés (customer/host/admin) + anonyme. Cible : zones peu explorées des audits 1–5 (auth secondaire, cycle de réservation complet, uploads, promotions admin, guest claim, exports).

> Conformité §16 : chaque constat provient d'un appel HTTP réel ou de la lecture du code de production. Les comportements sains sont listés en fin de rapport.

---

## Synthèse des problèmes

| # | Sévérité | Zone | Problème |
|---|----------|------|----------|
| **P1** | 🟠 Moyenne | **Promotions admin** | La création accepte un pourcentage **> 100 %** et une plage de dates **inversée** (`validUntil < validFrom`). Données incohérentes stockées. L'exécution est protégée (remise plafonnée, promo jamais active), mais le back-office peut enregistrer des promos absurdes. |
| **P2** | 🟡 Basse | **Vote d'avis « utile »** | Le double vote renvoie **HTTP 429** (« trop de tentatives ») avec un `Retry-After` de 24 h — sémantique trompeuse pour une action légitime déjà effectuée ; pas de retour visuel « déjà voté » cohérent. |
| **P3** | 🟡 Basse | **Upload d'images** | Le type MIME validé est celui **déclaré par le client** (un simple `.txt` renommé `.jpg` passe). Pas de vérification du contenu réel (magic bytes). Acceptable en dev/local, à durcir pour la prod S3. |

Aucune régression introduite par cet audit (phase d'investigation, aucun code de production modifié). Les données de test ont toutes été supprimées.

---

## P1 — Validation de création de promotions insuffisante (🟠)

### Preuve (exécution réelle)
- `POST /api/promotions` admin avec `type:"percentage", value:150` → **201 créé** (`value:"150.00"`).
- `POST /api/promotions` admin avec `validFrom:"2026-12-31"` et `validUntil:"2026-09-01"` (plage inversée) → **201 créé**.
- Schéma en cause (`src/app/api/promotions/route.ts`) :
  ```ts
  const createSchema = z.object({
    code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/),
    name: z.string().min(3).max(100),
    type: z.enum(["percentage", "fixed_amount"]),
    value: z.number().positive(),          // ← accepte 150, 1000…
    validFrom: z.string(),                  // ← aucune vérif de cohérence
    validUntil: z.string(),
    maxUses: z.number().int().positive().optional(),
    // ...
  });
  ```

### Impact réel limité mais réel
- **Pourcentage > 100 %** : le calcul de remise est **sécurisé** — `applyPromoToTotal` applique `discount = Math.min(discount, total)` (`src/lib/promotions.ts:63`), donc un total ne devient jamais négatif. Le risque est surtout la confusion/les données sales dans le back-office et un rendu « -150 % » dans l'interface.
- **Dates inversées** : la promo n'est **jamais utilisable** (à l'usage `isPromoUsable` renvoie « Code pas encore actif » — vérifié : `apply?code=DATESINVT` → 400 « Code pas encore actif »). C'est donc une promo « morte » qui encombre la liste admin sans être détectée à la saisie.
- Le formulaire client (`src/components/promotion-form.tsx`) ne valide **ni** le plafond du pourcentage **ni** l'ordre des dates non plus.

### Solution proposée (sans régression)
Durcir **le schéma Zod de création** (et idéalement la règle de validation côté formulaire), sans toucher au calcul (qui reste défensif) :

1. **Pourcentage plafonné à 100** :
   ```ts
   value: z.number().positive().superRefine((v, ctx) => {
     // Le plafond ne s'applique qu'aux pourcentages ; on raffine après
     // lecture de `type` via un .refine sur l'objet complet (voir ci-dessous).
   }),
   ```
   Plus propre : un `.refine` au niveau de l'objet :
   ```ts
   const createSchema = z.object({ ... }).refine(
     (d) => d.type !== "percentage" || d.value <= 100,
     { message: "Une remise en pourcentage doit être comprise entre 0 et 100", path: ["value"] },
   ).refine(
     (d) => new Date(d.validUntil) > new Date(d.validFrom),
     { message: "La date de fin doit être postérieure à la date de début", path: ["validUntil"] },
   );
   ```
2. (Optionnel) Vérifier la cohérence `fixed_amount` vs montant — non bloquant.
3. Ajouter les mêmes gardes côté `promotion-form.tsx` (retour visuel avant l'appel API).

**Aucun impact sur les promos existantes** : la validation ne s'applique qu'à la création/mise à jour. Le calcul de remise reste inchangé (et déjà sûr).

---

## P2 — Double vote « utile » : code retour sémantiquement trompeur (🟡)

### Preuve
- `POST /api/reviews/<id>/helpful` une première fois → **200** `helpfulCount:1`.
- Second appel (même user) → **429** `{ error: "Vous avez déjà marqué cet avis comme utile", "Retry-After": 86400 }`.

### Cause / problème
Le double-vote est bloqué par un **rate-limit 1 / 24 h** (`rateLimit("helpful:<user>:<review>", { limit:1, windowMs: 24h })`) en plus de la contrainte unique `(reviewId,userId)`. Le comportement « un seul vote » est correct et souhaité, mais :
- **429** signifie « trop de requêtes, réessayez plus tard » — or l'utilisateur ne doit **jamais** re-voter (ce n'est pas une limitation temporaire). Le statut sémantiquement correct est **409 Conflict** (« déjà voté »).
- Le composant `review-helpful-button.tsx` se désactive après vote (`state="done"`), donc l'UI est correcte ; le souci est surtout pour tout client API et le `Retry-After: 86400` trompeur.
- Pas de possibilité de **retirer** son vote (pas de DELETE/toggle) — choix assumé possible, mais non documenté comme limite.

### Solution proposée (sans régression)
- Séparer la détection du doublon du rate-limit anti-spam : conserver le vote unique via la contrainte `reviewVotes` (déjà en place, `onConflictDoNothing`) et renvoyer **409** avec un message « Vous avez déjà marqué cet avis comme utile » quand le vote existe déjà ; réserver le **429** au vrai spam (plusieurs avis/actions rapprochés).
- Optionnel : si le toggle (vote / retrait) est souhaité un jour, ajouter `DELETE /api/reviews/[id]/helpful`. Aujourd'hui le vote unique est défendable → le strict minimum est le bon statut HTTP.

---

## P3 — Upload : le type MIME est celui déclaré par le client, pas le contenu (🟡)

### Preuve
- Création d'un fichier texte de 20 octets (`this is not an image`) uploadé avec `Content-Type: image/jpeg` → **201**, fichier servi publiquement sous `/uploads/<key>.jpg` (contenu `text` servi en `image/jpeg`).

### Constat
- L'API valide que le MIME **déclaré** est dans `ALLOWED_UPLOAD_MIMES` (jpeg/png/webp/gif) et applique une **limite de taille 5 Mo** (`MAX_UPLOAD_BYTES`). L'extension est imposée côté serveur d'après le MIME.
- Il n'y a **pas de vérification des « magic bytes »** (signature réelle du fichier). Un utilisateur authentifié (hôte) peut donc stocker un non-image dans le stockage local public.
- Atténuations existantes : accès **host-only** (403 pour les clients), taille plafonnée, nom de fichier sans traversée de chemin (`[A-Za-z0-9._-]+`), la suppression vérifie la propriété (préfixe `uploads/<userId>-`) et l'état « déjà joint ».
- En **production S3**, ce contenu non-image est moins critique (servi sans exécution), mais reste un durcissement attendu.

### Solution proposée (sans régression)
- Ajouter une vérification légère de signature en tête de fichier avant d'accepter (par ex. constater les octets `FF D8 FF` pour JPEG, `89 50 4E 47` pour PNG, `RIFF….WEBP` pour WebP, `GIF8` pour GIF). C'est une garde purement additive : les vraies images passent, les faux fichiers sont rejetés à l'upload (400).
- Servir les images avec un `Content-Type` dérivé de la signature plutôt que de l'en-tête client.
- Ne change rien au flux des messages (pièces jointes) ni à la limite de taille.

---

## Comportements vérifiés SAINS (ne pas toucher)

Ces parcours ont été exercés en réel et fonctionnent correctement :

- **Mot de passe oublié** : pas d'énumération d'utilisateurs (même réponse générique pour email existant/inexistant) ; email invalide → 400 ; token de reset stocké **hashé** (jamais en clair).
- **Réinitialisation** : token invalide/trop court → 400 « Lien invalide ou expiré » ; mot de passe < 8 → 400.
- **Changement de mot de passe** (connecté) : mauvais ancien mdp → erreur ; après succès, **toutes les autres sessions sont révoquées** (401) tandis que la session courante reste active ; l'ancien mot de passe ne permet plus de se connecter, le nouveau oui. Le front (`change-password-form`) et l'API utilisent les mêmes champs (`oldPassword`/`newPassword`).
- **Vérification email** : token invalide → redirection propre vers `/verifier-email?ok=0`.
- **Guest claim (réclamation invité)** : réservation invitée → profil sans mot de passe (`password_hash = null`, `email_verified=false`) ; le register classique est **refusé** (anti-détournement) ; un token `guest_claim` est émis ; `reset-password` avec `claimGuest:true` consomme le bon type de token, définit le mdp, supprime les autres sessions et ouvre une session. Login sans mdp → 401 propre.
- **Cycle d'annulation** : le devis `GET /api/bookings/[id]/cancellation` calcule frais/remboursement (séjour à 139 j → frais 0, remboursement total) ; isolation (autrui → 403, inexistant → 404) ; annulation réelle via `PUT status:cancelled` (raison conservée, `refund_status=refunded`, `cancelled_at` posé) ; **double annulation → 409**.
- **Facture** : `GET /api/bookings/[id]/invoice` contrôlé (owner/host/admin, sinon 403 ; inexistant 404) ; reçu HTML indiquant bien le statut (y compris « cancel »).
- **Paiement** : booking inexistant → 404 ; webhook Stripe sans signature → 400 « Invalid signature » ; un **hôte ne peut pas déclencher le paiement** d'une résa client (403).
- **Avis** : réponse hôte (`reply`) réservée au propriétaire de la propriété / admin (customer → 403, propriétaire → 200) ; vote « utile » exige la connexion (401) et est unique (contrainte `reviewId,userId`).
- **Promotions — exécution** : remise **plafonnée au total** (jamais de total négatif, même avec 150 %) ; promo dates inversées inutilisable (« pas encore actif ») ; montant négatif/absent au devis `apply` → 400 ; création/écriture **admin-only** (host → 403) ; code en double → 409 ; suppression admin OK.
- **Chambres/propriétés (hôte)** : PUT chambre par le propriétaire → 200 et persisté ; par un customer → 403 ; id non-UUID → 400. Upload host-only (customer → 403), taille limitée à 5 Mo, anti path-traversal (`..%2f` → 404), suppression sécurisée (propriété + état joint).
- **Exports** : `GET /api/dashboard/billing/export` → CSV téléchargeable (`Content-Disposition: attachment`), host/admin uniquement (customer → 403).
- **Bulk admin** : payload mal formé → 400, entité inconnue → 400, customer → 403.
- **Alertes prix** : suppression filtrée par `userId` (un autre utilisateur obtient 404 « introuvable ») ; id non-UUID → 400.
- **Recherche** : `minPrice > maxPrice` → 0 résultat (cohérent), tri inconnu toléré sans erreur, `limit` borné à 100, `guests=abc`/`guests=-5` → 400.
- **Messagerie** : création de conversation ou envoi anonyme → 401 ; vérification de participant en place.
- **Rendu des pages** (3 rôles + anonyme) : toutes les pages dashboard host/admin rendent 200 pour le bon rôle et 307 sinon (promotions/settings = admin-only, **absentes de la sidebar hôte** donc pas de lien mort) ; `/dashboard/*` et `/mon-compte` anonymes → 307 ; pages statiques (`/aide`, `/mentions-legales`, `/confidentialite`, `/maintenance`) → 200 ; wishlist partagée avec token inexistant → page not-found gérée.
- **Health** : `/api/health` → `{ok:true}`.

---

## Données de test

Toutes les données créées pendant l'audit ont été supprimées/remises en état :
promotions de test (`PCT150TEST`, `DATESINVT`, `AUDIT6VALID`) supprimées ; réponse d'avis de test effacée (`host_reply=null`) et vote de test retiré (`helpful_count` recalculé) ; utilisateur `resettest@test.com` supprimé (sessions/tokens inclus) ; invité `gina.claim.a6*` (réservation + profil + tokens) supprimé ; réservation d'annulation `MBB-2026-HS5Z9T` remise en `confirmed` (pour rejouabilité du smoke) ; alerte résiduelle du smoke nettoyée ; image d'upload de test retirée. Aucun code de production modifié durant cet audit.
