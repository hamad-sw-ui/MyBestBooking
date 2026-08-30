# T-128 — Analyse d'impact (§14) : verrou de pages en mode maintenance (audit n°8, P1)

- **Date** : 2026-08-28 · **Niveau** : **L** (additif, aucun schéma, aucune migration, aucun changement de contrat d'API existant).
- **Origine** : `REPORTS/audit_fonctionnel_profond8_2026-08-28.md` (P1).

## 1. Problème (rappel, prouvé à l'exécution en dev **et** prod)

Quand un admin active `security.maintenanceMode` :
- les **écritures API** sont bloquées (503 `MAINTENANCE_MODE`) → aucune transaction ne passe ;
- mais un **chargement direct** (URL tapée / rechargement / lien externe) d'une page publique (`/`, `/recherche`…) répond **200 avec le contenu normal** : la garde RSC `redirect("/maintenance")` est bien exécutée (log de preuve) mais n'émet ni 307 ni meta de redirection client dans la réponse initiale. Le proxy **edge** (`src/proxy.ts`), lui, émet des 307 (vérifié) mais **ne peut pas lire la base** (runtime edge : pas de `pg`), et un cookie posé à l'admin ne serait pas envoyé par les autres visiteurs.

## 2. Solution retenue : garde client légère `MaintenanceGate`

Pourquoi ce choix plutôt que le edge :
- Le proxy edge n'a pas accès à Postgres (`pg`/bcrypt interdits dans le bundle edge, comme l'explique le commentaire en tête de `src/proxy.ts`).
- Un cookie de maintenance posé dans la **réponse** de l'admin ne partagerait pas l'état aux navigateurs des autres visiteurs ; le propager nécessiterait un canal d'état distribué que l'app n'a pas.
- Un composant client s'exécute **à chaque chargement de document** (y compris directs), après hydratation : il peut lire l'état réel (via une route Node qui, elle, lit la base) et forcer `window.location.replace("/maintenance")`. C'est fiable pour les plein-chargements comme pour la navigation.

### Composants

1. **Route publique d'état** : `GET /api/maintenance-status` → `{ active: boolean }`.
   - Route handler Node (runtime par défaut), **sans authentification** (la page de maintenance est publique), très légère, avec cache de réponse court (`s-maxage`/`stale-while-revalidate`) et cache mémoire en module (TTL ~30 s) pour éviter un accès DB par requête.
   - Ne divulgue rien d'autre qu'un booléen.
2. **Logique pure testable** `src/lib/maintenance-gate.ts` :
   - `chooseMaintenanceGate(active, { isMaintenancePath, isAdmin }) : boolean` → `true` si la gate doit rediriger (maintenance active, pas déjà sur `/maintenance`, utilisateur non admin). Pur → tests unitaires.
3. **Composant client** `src/components/maintenance-gate.tsx` (`"use client"`) :
   - Monté dans le **layout racine** `src/app/layout.tsx` (couvre toutes les pages, y compris `/` hors du groupe `(main)` et `/dashboard`).
   - Au montage : appelle `/api/maintenance-status` ; si `active` et que le chemin n'est pas `/maintenance` et que l'utilisateur (lu via un petit endpoint ou un flag injecté) n'est pas admin → `window.location.replace("/maintenance")`.
   - Passe en `noindex`/meta quand actif (bonus SEO) ; n'affiche rien d'autre (ne casse aucune mise en page).
   - **Admin** : ne redirige pas (il doit pouvoir désactiver le mode). Le rôle admin est fourni par un composant serveur qui lit `getCurrentUser()` et passe un prop `admin={boolean}` à la gate (aucun secret).
4. **Conservation des défenses existantes** (aucune suppression) :
   - `assertNotMaintenance` → **503** sur les écritures API (sécurité) : inchangé.
   - Gardes RSC `redirect("/maintenance")` dans `(main)/layout.tsx`, `page.tsx`, `dashboard/layout.tsx` : **conservées** (elles protègent la navigation client `<Link>` et servent de seconde couche).
   - `shouldBypassMaintenance` (déjà testée) : reste la whitelist de référence, réutilisée par la gate pour NE PAS rediriger `/connexion`, `/inscription`, `/_next/*`, etc.

## 3. Les 9 questions (§14)

1. **Fichiers** : `src/app/api/maintenance-status/route.ts` (nouveau), `src/lib/maintenance-gate.ts` (nouveau, pur), `src/components/maintenance-gate.tsx` (nouveau, client), `src/app/layout.tsx` (montage de la gate, 2-3 lignes), `src/lib/maintenance-gate.test.ts` (nouveaux tests). Aucun fichier existant modifié dans sa logique.
2. **Contrats d'API** : ajout d'une route publique en lecture seule. Aucun contrat existant modifié ; les 503 API restent identiques.
3. **Données** : aucune migration, aucun changement de schéma. La gate lit le setting `security.maintenanceMode` déjà présent.
4. **Parcours (3 rôles + anonyme)** :
   - Anonyme / customer / host, maintenance ON, sur n'importe quelle page → redirection automatique vers `/maintenance` (plein-chargement comme navigation).
   - Admin, maintenance ON → aucune redirection (il accède au site et au panneau pour désactiver).
   - Maintenance OFF → la route d'état renvoie `active:false`, la gate ne fait rien (comportement du site strictement identique à aujourd'hui).
   - `/maintenance`, `/connexion`, `/inscription`, assets, `/api/auth/*` → jamais redirigés (whitelist `shouldBypassMaintenance`), pour garantir l'anti-verrouillage.
5. **Composants critiques** : la gate n'intervient pas dans la réservation/paiement ; elle n'agit que sur l'affichage. Les 503 API demeurent le verrou de sécurité.
6. **Tests** : tests purs pour `chooseMaintenanceGate` (admin ne redirige pas ; maintenance OFF ne redirige pas ; chemin `/maintenance` ne redirige pas ; whitelist respectée ; sinon redirige). Tests/smoke existants reconduits.
7. **Effets de bord** : une requête GET légère par chargement de page (mise en cache ~30 s) ; aucune écriture.
8. **Risques de régression** :
   - Maintenance OFF → `active:false` → gate inerte (zéro effet sur le rendu normal). C'est le cas dominant.
   - La gate ne doit jamais bloquer l'admin ni les pages de login (sinon verrouillage) → pilotée par le prop `admin` (sûr, vient du serveur) ET par la whitelist.
   - Elle ne doit pas rendre une page blanche : elle n'affiche rien (retourne `null`) et ne fait que rediriger si besoin.
   - Sur `/maintenance` elle se neutralise (sinon boucle).
9. **Validation (§13)** : typecheck · lint · tests (nouveaux + 251 existants) · build · smoke · ai:check · exécution réelle maintenance ON/OFF en dev (3 rôles + anonyme) **et** vérification en `next start` (prod).

## 4. Rollback
Révert du commit de code ; aucune migration ni donnée à annuler.
