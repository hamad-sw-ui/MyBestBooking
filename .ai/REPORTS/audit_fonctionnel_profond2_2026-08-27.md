# 🔍 Second audit fonctionnel profond — scénarios & éléments inachevés / mal pensés

> Date : 2026-08-27 (après T-119). Méthode : **exécution réelle** (Postgres +
> Next + seed, sessions customer/host/admin), en éprouvant cette fois les
> flux **non couverts** par le 1er audit : inscription/profil/2FA, réservation
> E2E (promo, rate-plan, wallet, annulation), calendrier/stop-sell/stock,
> messagerie, wishlist partagée, alertes prix, actions groupées, modération,
> export billing. Chaque constat est vérifié par un appel HTTP ou un log
> serveur, jamais supposé. Toutes les solutions sont **non régressives**.

## Couverture vérifiée (solidité confirmée — à ne pas casser)

| Flux | Constat à l'exécution |
|---|---|
| Inscription | Email pris → 400, mdp < 8 → 400, email invalide → 400, champ manquant → 400. |
| Reset / anti-énumération | `forgot-password` répond un message identique que l'email existe ou non (200). |
| 2FA TOTP | Sans session → 401 ; setup avec bon mdp → secret 200 ; mauvais mdp → 401 ; remplacement protégé par code courant. |
| Change mdp | Ancien faux → 400, nouveau < 8 → 400, schéma `oldPassword/newPassword` strict. |
| Réservation | Dates passées / départ≤arrivée / surcapacité (409) / chambre d'une autre propriété / chambre inexistante → tous refusés proprement. |
| Annulation | Devis `cancellation` cohérent (frais 0 en flexible lointain, remboursement = total). |
| Promos | Code inconnu → 404, vide → 400, montant négatif → 400. |
| Rate-plans | Création 201, discount > 100 → 400, **customer (non proprio) → 403**, remise bien appliquée au booking (`ratePlanDiscount`). |
| **Stop-sell / stock** | Pose en `PUT` (batch `days[]`), **host non proprio → 403** ; stop-sell sur toutes les chambres d'une propriété → elle disparaît de la recherche (8→7) et **toute réservation sur une date stop-sellée est refusée (409)** ; stock journalier à 0 → 409. Cohérence calendrier ↔ recherche ↔ réservation **parfaitement vérifiée**. |
| Messagerie | Conversation idempotente (clé unique), protection IDOR (`checkParticipant`). |
| Wishlist partagée | `isPublic:true` → token généré, lisible **sans connexion** (200) ; `isPublic:false` → pas de token. |
| Alertes prix | `maxPrice` positif requis (négatif → 400), anonyme → 401. |
| Suspension | host → 403, admin → 200 (sessions révoquées), auto-suspension refusée ; le compte suspendu ne peut plus se connecter (401). |
| Modération avis | customer → 403, statut invalide → 400, avis inexistant → 404, hidden/approved → 200. |
| Bulk admin | Action inconnue / entité inconnue / UUID invalide / liste vide → 400. |
| Export billing | host = ses biens, admin = tout ; 403 pour les autres rôles. (8 hébergements des deux côtés car le seed attribue les biens au host — coïncidence, pas une fuite.) |
| Profil | email/rôle/wallet **non modifiables** via `PATCH /api/users/me` (champs hors schéma), firstName vide → 400. |

---

## 🟠 DÉFONCTIONNEL

### D1 — Corps JSON vide ou mal formé → HTTP 500 sur les routes d'écriture
**Sévérité : moyenne-haute (robustesse API + bruit d'erreurs 500 en prod)**

**Preuve d'exécution** (corps vide `-d ''` ou JSON cassé `{name:}`) :
```
POST /api/auth/register   body vide → 500
POST /api/bookings        body vide → 500
POST /api/reviews         body vide → 500
POST /api/wishlists       body vide / {name:} → 500
POST /api/auth/2fa/setup  body vide → 500
```
**Cause racine** (confirmée par les logs Next) :
`await request.json()` lève une `SyntaxError` quand le corps est vide ou
mal formé, **avant** que Zod ne valide. Le `catch` ne filtre que
`ZodError` :
```ts
} catch (error) {
  if (error instanceof z.ZodError) return ... 400;
  console.error(...);
  return ... { status: 500 };   // ← la SyntaxError atterrit ici
}
```
Conséquences : un client bogué (ou une sonde, ou un en-tête Content-Type
trompeur) génère de **fausses erreurs serveur 500** (qui déclenchent
alertes/Sentry), au lieu d'une simple erreur de requête 400. C'est sans
danger pour les données (rien n'est écrit), mais c'est un défaut de
contrat HTTP et une pollution du monitoring.

**Solution sans régression**
Centraliser une lecture de corps tolérante dans `src/lib/http.ts` (ou
étendre l'aide existante) :
```ts
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;                       // corps absent/mal formé
  }
}
```
Puis dans chaque route d'écriture, remplacer
`schema.parse(await request.json())` par :
```ts
const raw = await readJsonBody(request);
if (raw === null || typeof raw !== "object") {
  return NextResponse.json({ error: "Corps de requête invalide ou manquant" }, { status: 400 });
}
const data = schema.parse(raw);
```
La branche `ZodError → 400` existante continue de gérer les champs
invalides ; on ajoute seulement le cas « JSON non parseable ». **Aucun
changement de comportement pour les appels valides** (l'UI envoie du JSON
correct). Peut être appliqué route par route (commencer par register,
bookings, reviews, wishlists, 2fa/setup) sans toucher à la logique métier.

---

## 🟡 ERGONOMIE / « MAL PENSÉ »

### E1 — Inscription sans champ « Confirmer le mot de passe »
**Sévérité : faible**

Le formulaire `/inscription` ne demande le mot de passe qu'une seule fois
(pas de `confirmPassword`). Une faute de frappe bloque l'utilisateur à la
connexion (il devra passer par « mot de passe oublié »). C'est un standard
de tout parcours d'inscription.

**Solution sans régression** : ajouter un second champ côté client avec
comparaison locale (`if (password !== confirm) setError("Les mots de passe
ne correspondent pas")`) et bloquer la soumission. **Aucun changement
API** (le backend ne reçoit que `password`, déjà validé).

### E2 — Message d'un compte suspendu : « Ce compte a été supprimé »
**Sévérité : faible (précision, pas un défaut de sécurité)**

À la connexion d'un compte suspendu (`deletedAt` posé par l'admin, qui est
réversible), l'API répond `{"error":"Ce compte a été supprimé"}` (401). Le
soft-delete servant aussi à la **suspension réversible** (l'admin a un
bouton réactiver), le message est trompeur : l'utilisateur croit son
compte détruit alors qu'il est désactivé.

**Solution sans régression** : distinguer les deux états s'ils existent en
base (suspension vs suppression définitive), sinon reformuler en
« Ce compte est désactivé. Contactez le support. » — un simple changement
de chaîne, sans toucher au code d'auth ni aux statuts.

---

## 🟢 CHOIX PRODUIT / CONSTATS MINEURS (à confirmer, aucune action requise)

- **Maintien de session en `/dashboard`** : un client non-host est
  redirigé par le layout server-side ; les API admin renvoient 403. C'est
  bien défendu en profondeur (page + API), rien à changer.
- **`/api/auth/verify?token=invalide` renvoie 307** (redirection) plutôt
  qu'une 400/404 JSON : c'est une route de lien d'e-mail qui renvoie vers
  une page d'erreur front, comportement acceptable.
- **B4 (taux d'occupation analytics)** reste le seul gap fonctionnel
  connu côté dashboard (déjà en backlog au 1er audit).

---

## 📋 Plan d'action recommandé

| # | Constat | Sévérité | Effort | Risque régr. | Décision |
|---|---|---|---|---|---|
| D1 | JSON invalide → 500 (au lieu de 400) sur routes d'écriture | Moy-haute | ~20 lignes + helper | Très faible (chemin valide inchangé) | **À corriger (T-120)** |
| E1 | Inscription sans confirmation mdp | Faible | ~15 lignes UI | Nul (API inchangée) | À corriger |
| E2 | Message « compte supprimé » pour suspension | Faible | 1 chaîne | Nul | À corriger |
| B4 | Taux d'occupation analytics | Faible | ~30 lignes | Nul | Backlog |

> Aucune modification de code dans ce rapport : analyse uniquement. Les
> correctifs D1/E1/E2 sont courts, isolés et vérifiables par 3 à 6 appels
> curl + smoke 91/91 + 228 tests, sans toucher aux parcours validés
> (auth, stop-sell/stock, booking, modération, rate-plans, messagerie,
> wishlist, factures). Données de test nettoyées en base (réservation,
> wishlists, alerte prix, rate-plan de test supprimés ; avis remis
> `approved`).
