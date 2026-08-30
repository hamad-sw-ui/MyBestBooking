# 📊 Analyse d'impact — T-025 Templates emails éditables

- **Date** : 2026-08-20 (Session 7, suite)
- **Tâche** : T-025 — Templates emails éditables via `app_settings`
- **Niveau** : **S** (nouvelle section settings, refactor 4 templates,
  helper de rendu, section UI dans /dashboard/settings)
- **Auteur** : Arena Agent Mode

## §14 — 9 questions obligatoires

### 1. Quoi

Permettre à un admin d'éditer **le sujet et le corps** (paragraphe
principal) de chaque email transactionnel — sans redéploiement, ni
changement de code. Le layout HTML (branding, boutons, disclaimer)
reste figé pour ne pas casser le rendu.

4 templates concernés :

- `emailVerification`
- `passwordReset`
- `bookingConfirmation`
- `bookingHostNotification`

Placeholders supportés (substitution `{name}`) : `firstName`, `url`,
`bookingReference`, `propertyName`, `checkIn`, `checkOut`, `total`,
`currency`, `guestFirstName`, `guestLastName`, `hostFirstName`.

### 2. Où

Nouveaux fichiers :

- `.ai/REPORTS/analyse_impact_2026-08-20_email_templates.md` (ce doc).
- `.ai/REPORTS/analyse_conception_2026-08-20_email_templates.md`.
- `src/lib/mail/render.ts` — `renderTemplate(subject, body, vars)`
  substitution `{name}` sécurisée + tests.
- `src/lib/mail/render.test.ts` — 6 tests unitaires.
- `src/components/admin/email-templates-section.tsx` — client.

Modifiés :

- `src/lib/settings.ts` — ajout section `emailTemplates` avec Zod +
  DEFAULTS (subject/body pour les 4 templates).
- `src/lib/mail/templates.ts` — les 4 fonctions lisent depuis
  `app_settings.emailTemplates` avec fallback DEFAULTS.
- `src/components/admin/settings-panel.tsx` — insère la nouvelle
  section.

### 3. Pourquoi

Backlog `T-025` explicite. Cas d'usage : ajuster le ton
saisonnier (« Bonnes fêtes ! »), personnaliser en cas de campagne,
corriger une faute d'orthographe sans PR.

### 4. Appelants

- Callers de templates :
  - `src/app/api/auth/register/route.ts` → `emailVerification`
  - `src/app/api/auth/forgot-password/route.ts` → `passwordReset`
  - `src/app/api/bookings/route.ts` (POST) → `bookingConfirmation` +
    `bookingHostNotification`
- Callers de settings : voir T-021, aucun cast à faire.
- `getSetting("emailTemplates")` = nouveau, appelé uniquement depuis
  les 4 fonctions templates.

### 5. Contrat public

- Nouvelle section `settings.emailTemplates` — additive.
- Signatures des 4 templates **inchangées** : `templates.xxx(vars)`
  retourne `{subject, html, text}` comme aujourd'hui. Seule
  l'implémentation change (lit d'abord settings, retombe sur
  DEFAULTS si absent).
- Comme `templates.xxx` devient `async`, on modifie les callers en
  conséquence (déjà tous dans `try/await getMailer().send(...)`).

### 6. Migration

Aucune migration DB (utilise `app_settings` existant). Aucun backfill :
sans row `emailTemplates`, les DEFAULTS reproduisent **exactement** le
texte des templates actuels → zéro régression.

### 7. Sécurité

- Éditeur : role admin only (déjà couvert par `/api/admin/settings`).
- Substitution : whitelist de variables + échappement HTML **strict**
  des valeurs injectées (empêche XSS via un utilisateur qui met
  `<script>` dans son firstName).
- Placeholders inconnus → laissés tels quels (pas d'erreur bruyante).
- Zod strict : `subject` 1-200 chars, `body` 1-5000 chars.

### 8. Test

Unitaires `src/lib/mail/render.test.ts` :

- Substitution basique `{firstName}` → « Marie ».
- Placeholder inconnu → laissé tel quel.
- Injection HTML dans une variable → échappée
  (`<script>` → `&lt;script&gt;`).
- Multiples placeholders + répétitions.
- Chaîne vide → retourne chaîne vide.
- `subject` séparé du `body`.

Manuel ▶️ :

1. Admin ouvre `/dashboard/settings` → section « Templates emails »
   présente.
2. Modifie le sujet de `bookingConfirmation` de « Confirmation de
   réservation » → « 🎉 Réservation confirmée !».
3. Crée une réservation → email envoyé (ConsoleMailer en dev) affiche
   le nouveau sujet.
4. Restaure le sujet.

### 9. Rollback

- `git revert` → `templates.xxx` redevient synchronise sur DEFAULTS
  in-code.
- Section settings `emailTemplates` peut rester en DB, inerte.
