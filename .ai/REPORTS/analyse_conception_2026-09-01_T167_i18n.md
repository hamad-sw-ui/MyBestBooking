# Analyse de conception — T-167 i18n vague 3

- Date : 2026-09-01 (clôture ; impact initial 2026-08-31)
- Tâche : T-167 · Niveau S
- Décisions (déjà en code, non revues) :

1. **Catalogue unique** `ui-strings.ts` FR/EN, mêmes clés ; `makeT` reste
   un lookup sans interpolation. Les placeholders `{n}` / `{currency}`
   sont substitués au call-site via `.replace` / `.replaceAll`.
2. **Client** : `useT()` depuis `UiLocaleProvider` (`initialLanguage`
   serveur). Jamais `t["key"]` ni `@/lib/use-t`.
3. **SSR** : `getServerLocale` = compte → header `x-ui-language` →
   cookies dual (`mybb-ui-language`, `mybb:ui-language`) → settings →
   `fr`. Le proxy tamponne `?lang=` / cookie → header sur les pages
   publiques matchées ; `/reservation` reste public.
4. **Hors périmètre** : pages légales/aide déjà bilingues, PDF facture,
   JSON API, placeholders d’exemple admin.

Non-régression : défaut FR sans cookie ; `makeT` inchangé ; matcher
public inchangé.
