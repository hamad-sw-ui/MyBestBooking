# Audit fonctionnel profond n°8 — MyBestBooking

- **Date** : 2026-08-28 · **Branche** : `arena/01a042cf-mybestbooking` (HEAD T-127 `09b57e5`)
- **Méthode** : exécution réelle (dev **et** prod `next start`, sessions customer/host/admin + anonyme), au-delà du HTTP 200 ; code relu. **Aucun code de production modifié** (sondes temporaires retirées) ; toutes les données de test nettoyées.
- **Périmètre neuf** : capacité/stop-sell/surbooking à la réservation, mode maintenance (API **et** pages), suspension/réactivation utilisateur, soft-delete, flux de validation admin des hébergements, garde `redirect()` RSC au plein-chargement.

## Synthèse

Le cœur métier (réservation, disponibilités, suspension de compte, soft-delete, modération d'hébergements) est **sain et bien défendu**. Cette passe met en évidence **un écart fonctionnel réel** (le verrou de pages en mode maintenance ne s'applique pas au plein-chargement), de sévérité moyenne, plus des points sains à ne pas régresser.

| Ref | Sévérité | Sujet |
|-----|----------|-------|
| **P1** | 🟠 Moyenne | En **mode maintenance**, les **écritures API sont bien bloquées (503)** mais les **pages ne redirigent pas** vers `/maintenance` au plein-chargement : un visiteur non-admin reçoit **200 + le contenu normal** du site. La garde RSC `redirect("/maintenance")` (layout `(main)`, page racine, layout dashboard) est **appelée mais n'émet pas de 307** lors d'un chargement direct — exactement la classe de problème que T-123 avait contournée pour les rôles en déplaçant la garde au **proxy edge**. |

---

## P1 — Mode maintenance : la garde de pages RSC ne verrouille pas le plein-chargement

### Preuves d'exécution (maintenance `true` en base, vérifié en dev **et** en prod `next start`)

```
API (handler) :
  POST /api/bookings                         → 503 {"code":"MAINTENANCE_MODE"}   ✅ bloqué
  (id. avis, uploads, promos/apply → 503 via assertNotMaintenance)
  POST /api/auth/login                        → 200  (whitelist anti-lockout)    ✅
  GET  /api/health                            → 200                               ✅

PAGES (plein-chargement, anonyme / non-admin) :
  GET /            → 200  (titre « …Réservez mieux… », contenu d'accueil rendu)  ❌ attendu 307 → /maintenance
  GET /recherche   → 200  (titre « Recherche d'hébergements », résultats rendus) ❌ attendu 307 → /maintenance
  GET /maintenance → 200                                                            ✅
Témoin : une redirection edge réelle fonctionne :
  GET /dashboard (anonyme) → 307 Location: /connexion?next=%2Fdashboard          ✅
```

**Instrumentation temporaire** (retirée ensuite) : un log dans le layout `(main)` a confirmé que le code de garde est bien atteint et appelle `redirect("/maintenance")` :

```
[MAINT-PROBE] (main) layout user.role= null maint= true
[MAINT-PROBE] (main) -> redirect /maintenance
GET /recherche 200 ...        # malgré l'appel redirect(), la réponse est 200 avec la page réelle
```

Un `redirect("/maintenance")` **inconditionnel** placé dans ce layout est lui aussi avalé (200 + page réelle), en dev Turbopack **comme en build de production**. Donc ce n'est ni un problème de logique métier (maint/role sont corrects), ni un cache de settings : c'est l'émission du 307 par la redirection RSC qui ne se produit pas sur un chargement direct de document dans ce runtime.

### Cause / contexte

- T-022 a posé les gardes de maintenance dans trois endroits **RSC** : `src/app/(main)/layout.tsx`, `src/app/page.tsx` (racine, hors groupe `(main)`) et `src/app/dashboard/layout.tsx`, chacune sous `redirect("/maintenance")`.
- T-123 (audit n°4) avait déjà rencontré la même limite : « les `redirect()` RSC ne produisent pas de 307 lors d'un chargement direct » — la solution retenue alors avait été de déplacer les gardes de **rôle dashboard** vers `src/proxy.ts` (edge), qui, lui, émet bien des 307 (constaté ci-dessus).
- La maintenance n'a **pas** été déplacée au proxy : le runtime **edge ne peut pas lire la base** (`pg`/`bcrypt` interdits), et `proxy.ts` ne couvre d'ailleurs que les routes protégées (matcher `mon-compte`, `mes-reservations`, `messages`, `dashboard…`), pas les pages publiques (`/`, `/recherche`).
- Une fonction `shouldBypassMaintenance(pathname)` existe (`src/lib/maintenance.ts`) et est testée (`maintenance.test.ts`), prévue pour une exécution edge, mais **n'est référencée par aucun runtime** — elle n'est utilisée que dans ses tests. C'est le signe d'un branchement edge **prévu mais non câblé**.

### Impact réel (à nuancer)

- **Aucune action d'écriture ne passe** en maintenance : réservations, avis, uploads, application de promo renvoient 503. Un visiteur ne peut donc **pas** réserver/acheter.
- L'écart est **cosmétique/UX + cohérence** : les pages publiques restent **lisibles en lecture** (on peut naviguer, voir des hébergements, consulter la page) alors que l'intention affichée (« Service momentanément en maintenance ») est de montrer l'écran de maintenance. Aucune fuite de donnée, aucun contournement d'autorisation.
- Sévérité **moyenne-basse** : l'objectif principal (figer les transactions pendant une opération) est atteint ; l'expérience « page de maintenance » ne l'est pas au plein-chargement. (En navigation client `<Link>`, la redirection RSC serait appliquée par le routeur ; le défaut ne touche que les chargements directs / rechargements / liens externes.)

### Solution sans régression

Deux options complémentaires, la plus sûre et la plus alignée avec T-123 étant l'option **A** :

**A. Verrou au proxy edge (recommandé).** Le proxy ne peut pas lire la DB, mais il peut lire un **indicateur de maintenance injecté dans un cookie signé** (ou un header) que l'admin pose en activant le mode, et qui reste cohérent ~60 s (TTL identique au cache settings) :
- Dans `setSetting("security", { maintenanceMode: true })`, en plus d'écrire en base, poser un cookie court **signé/HMAC** (ex. `mb_maint`, httpOnly, path `/`, durée ~120 s) ; le retirer à la désactivation.
- Dans `proxy.ts` : étendre le matcher à **toutes les pages** (hors la whitelist `shouldBypassMaintenance` : `/maintenance`, `/connexion`, `/inscription`, `/_next/*`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`, `/uploads/*`) ; si le cookie de maintenance est présent **et que la session JWT n'est pas admin**, `NextResponse.redirect("/maintenance")` (307, comme le proxy sait déjà le faire).
- **Anti-verrouillage** : les routes `/api/auth/*` et `/api/admin/*` restent hors champ (l'admin peut se connecter et désactiver). La whitelist existe déjà (`shouldBypassMaintenance`) — il suffit de l'importer dans le proxy (pur, sans DB, compatible edge).
- Les gardes RSC existantes sont **conservées** (défense en profondeur pour la navigation client et les routes non couvertes par le matcher).
- **Non-régression** : tant que le cookie est absent (mode normal), le proxy ne change rien ; les admins (rôle dans le JWT) ne sont jamais redirigés ; aucune écriture DB supplémentaire.

**B. Garde côté client (solution légère, sans edge).** Un petit composant client (ex. `<MaintenanceGate>`) monté dans le layout racine qui appelle une route **qui existe déjà au runtime node** (ex. `GET /api/health` enrichi d'un flag public, ou une sonde `GET /api/maintenance-status`) et, si maintenance active et utilisateur non-admin, déclenche `router.replace("/maintenance")`. Couvre aussi les chargements directs (le JS s'exécute au montage), sans toucher au edge. Moins « immédiat » qu'un 307 (la page s'affiche un court instant) mais **très faible risque** et aucune dépendance cookie/edge.

L'option A reproduit le pattern qui a déjà fait ses preuves sur T-123 et rend `shouldBypassMaintenance` enfin utilisée.

---

## Zones vérifiées SAINES à l'exécution (à ne pas régresser)

- **Réservation — capacité** : 5 adultes sur une chambre « max 2 adultes » → **409** « …au maximum 2 adultes » ; 1 enfant sur une chambre « 0 enfant » → **409** « …au maximum 0 enfant » ; 0 nuit → 400 (audit 6).
- **Réservation — stop-sell / stock** : poser `stopSell:true` (PUT availability) sur les nuits du séjour → la réservation est rejetée **409** « Cette chambre n'est plus disponible pour ces dates ». Le calcul de stock par nuit (`availableCount` plafonné par `room.quantity`, chevauchements de réservations comptés, `FOR UPDATE` sur les nuits et l'utilisateur) est complet et correct dans `evaluateBookingRules`.
- **Cohérence chambre/propriété** : une chambre d'une autre propriété passée avec un `propertyId` étranger → 400 « Chambre non disponible » (le chargement chambre filtre bien `room.propertyId = data.propertyId`).
- **Suspension de compte (admin)** : suspendre → `deletedAt` posé + **sessions révoquées** (l'ancien cookie reçoit 401) ; re-login d'un compte suspendu → **401** « Ce compte est désactivé… » ; auto-suspension admin → **400** ; **réactivation** (`suspended:false`) → `deletedAt:null`, re-login **200**. Le motif est journalisé (audit).
- **Soft-delete RGPD** (`DELETE /api/users/me`) : anonymise email (`deleted-<hash>@anonymized.local`), prénom/nom/téléphone/avatar/2FA, révoque les sessions, supprime le cookie ; un admin ne peut pas se supprimer (400). `getCurrentUser` renvoie `null` si `deletedAt`.
- **Validation d'hébergements** : un hôte crée une propriété en `pending` (admin → `active`) ; `POST /api/properties/[id]/validate` réserve l'admin (403 sinon), mappe `approve→active (+validatedAt/By)`, `reject→draft` (re-soumission possible), `suspend→suspended`, et journalise chaque action.
- **Mode maintenance — partie API** : `assertNotMaintenance` bloque réservations/avis/uploads/apply-promo en 503 pour les non-admins ; auth/login et health restent ouverts ; l'admin traverse (bypass).
- **Pages statiques/gardées** : `/maintenance` rend 200 (pas de boucle) ; `(auth)` laisse `/connexion` et `/inscription` ouvertes (nécessaire pour qu'un admin se connecte pendant la maintenance).
- **Rappels audit 7 toujours verts** : alerte/favori sur propriété inexistante → 404 ; pièce jointe non-image → 400 ; export facturation filtrable.

## Aucune donnée de test résiduelle

- Utilisateur jetable `suspend.a8@test.com` supprimé (sessions + verification_tokens), 0 restant.
- Lignes d'availability `stop_sell` de test supprimées (0 résiduel) ; réservations de test/sonde nettoyées.
- Mode maintenance **remis à `false`** en base (vérifié).
- Sondes temporaires (route API `zzprobe`/`_maint_probe`, logs `[MAINT-PROBE]`) **intégralement retirées** ; arbre de sources identique à avant l'audit.
