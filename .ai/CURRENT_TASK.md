# 🎯 TÂCHE EN COURS

**Tâche :** T-145 — implémentation des remarques produit (photo de profil,
commission par hébergement admin, langue « ar »), sans régression.

**Implémenté (additif, aucune migration, paiement non touché) :**
1. 🔨 **Photo de profil depuis le gestionnaire de fichiers** : nouvelle route
   `POST /api/users/me/avatar` (tous rôles connectés, uploader public + magic
   bytes + 5 Mo + rate-limit + maintenance), persiste `users.avatarUrl`
   immédiatement ; `ProfileForm` gagne un bouton « Importer depuis
   l'ordinateur » (`PhotoUploadButton`) avec aperçu (le champ URL reste).
2. 🔨 **Commission par hébergement côté admin** : carte « Commission
   plateforme » (taux %, 0–100) dans l'édition d'hébergement, visible/admin
   seulement (`/api/auth/me`) ; envoyée au PUT seulement si admin. Le backend
   refusait déjà la commission à un hôte (403) — l'UI est désormais cohérente.
3. 🔨 **Langue « arabe » retirée** des sélecteurs (`settings-panel`, libellé
   `profile-form`) : seule la locale UI fr|en est réelle. Hook défensif déjà en
   place (retombe sur fr). Pas de migration de réglage.

**Non implémenté volontairement (ressources externes, non simulables à blanc) :**
Stripe Connect / versements bancaires hôtes (comptes connectés + transfers) et
validation du paiement carte réel — le code bascule dès que les clés Stripe sont
fournies.

**Preuves :** avatar anon 401 / client+hôte 200 / faux-fichier 400 / image servie
200 ; commission admin 18%→200, hôte 403 et valeur inchangée (restaurée 15) ;
PROD (next start 3100) avatar 200/401. Données de test nettoyées.

**ID** : T-145. **Niveau** : L. **Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-145)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288 (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **59 pages**) ·
  `ai:check` **19 OK · 1 warn · 0 fail**.
- Rapport : `.ai/REPORTS/validation_T-145_2026-08-29.md`.
