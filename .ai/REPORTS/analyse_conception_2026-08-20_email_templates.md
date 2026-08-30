# 🧠 Conception — T-025 Templates emails éditables

- **Date** : 2026-08-20 (Session 7, suite)
- **Auteur** : Arena Agent Mode

## Problème

Voir `analyse_impact_2026-08-20_email_templates.md`. Le contenu texte
des emails est en dur dans `src/lib/mail/templates.ts` → aucune
personnalisation possible sans PR.

## Options considérées

### Option A — moteur Mustache/Handlebars complet

- ➕ syntaxe riche (conditionnels, boucles).
- ➖ dépendance externe, surface d'attaque plus large.
- ➖ over-engineering pour 4 templates simples.

### Option B — substitution `{name}` maison — **retenue**

- ➕ ~15 lignes de code, testable trivialement.
- ➕ échappement HTML **explicite** des variables.
- ➕ pas de dépendance externe.
- ➖ pas de logique conditionnelle (acceptable pour la V1).

### Option C — templates en JSX

- ➖ éditables uniquement par un dev, ce qui rate le but.

Choix : **Option B**.

## Architecture retenue

```
Admin édite subject/body dans /dashboard/settings
        │
        │ PATCH /api/admin/settings/emailTemplates
        ▼
app_settings.emailTemplates = { emailVerification: {subject, body}, ... }
        │
        ▼
templates.emailVerification({firstName, url}) — async
        │
        │ getSetting("emailTemplates") avec fallback DEFAULTS
        ▼
renderTemplate(subject, body, {firstName, url})
        │
        │ substitution {name} + escape HTML
        ▼
layout(rendered) → {subject, html, text}
```

### Contrat `renderTemplate`

```ts
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string;
```

- Remplace `{key}` par `escapeHtml(String(vars[key]))`.
- Placeholder inconnu → laissé tel quel (pas d'erreur).
- Chaîne vide → chaîne vide.

### Section settings `emailTemplates`

```ts
export const emailTemplatesSchema = z.object({
  emailVerification: z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
  }),
  passwordReset: z.object({ subject: z..., body: z... }),
  bookingConfirmation: z.object({ subject: z..., body: z... }),
  bookingHostNotification: z.object({ subject: z..., body: z... }),
});
```

DEFAULTS = extraits exacts du texte actuel des 4 templates → zéro
régression.

### Layout figé

Le HTML de layout (header logo, footer disclaimer, boutons) reste
en code — non éditable pour préserver le branding et l'accessibilité.
Seul le paragraphe principal (`body`) est piloté par settings.

## Plan de migration

1. `src/lib/mail/render.ts` + tests.
2. Section `emailTemplates` dans `src/lib/settings.ts` + DEFAULTS.
3. Refactor `templates.ts` : les 4 fonctions deviennent async, lisent
   settings, injectent via `renderTemplate`.
4. Composant admin section dans `<SettingsPanel>`.
5. Tests + manuel.

## Débat multi-rôles §15.2

Non requis (niveau S, consensus).
