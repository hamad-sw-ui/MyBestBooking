# Analyse d'impact — T-173 fiabilité de la bascule de langue (cache client)

- **Date** : 2026-09-01
- **Tâche** : T-173
- **Niveau** : S (correctif client ciblé ; aucun contrat API/SSR modifié)

## Problème (reproduit par lecture de code + scénario)

- Connexion et inscription redirigent en **navigation SPA**
  (`router.push` + `router.refresh`) — sans plein rechargement.
- `useDisplayPreferences` résout langue/devise via une **promesse cachée au
  niveau module** (`cached`), jamais invalidée.
- Conséquence : après login, le RSC re-rend avec la langue **du compte**
  (priorité voulue, T-152) pendant que les composants client affichent la
  langue **anonyme d'avant login** (localStorage) → **page mixte FR/EN**
  jusqu'au prochain F5. C'est le « problème de fiabilité » remonté.
- Défaut secondaire : `LanguageSelector` écrivait localStorage/cookies
  **avant** le PATCH profil ; en cas d'échec, l'état local restait sur la
  nouvelle langue alors que le compte gardait l'ancienne.

## Surface impactée

- `src/lib/use-display-currency.ts` : événement `DISPLAY_PREFS_EVENT`,
  `invalidateDisplayPreferences()` (reset + dispatch, SSR-safe), hook
  abonné à l'événement, export additif `resolveDisplayPreferences()`.
  `resetDisplayPreferencesCache()` **inchangé** (utilisé par les deux
  sélecteurs avant leur `window.location.assign`).
- `src/app/(auth)/connexion/login-client.tsx` ·
  `src/app/(auth)/inscription/register-client.tsx` : invalidation après
  succès, avant `router.push`.
- `src/components/language-selector.tsx` : rollback local (setState +
  stockage) si le PATCH échoue.
- `src/lib/use-display-currency.test.ts` : 3 tests (cache, invalidation +
  re-fetch prouvant le scénario anonyme-en → compte-fr, SSR-safe).

## Risques & garde-fous

- Boucle d'événements : le listener ne dispatch jamais (lecture seule) →
  impossible.
- Double fetch : `load()` reste une promesse unique par résolution
  (dedup conservé).
- SSR : guards `typeof window !== "undefined"` (vérifié par le test
  « SSR-safe » + build).
- Sélecteurs devise/langue : comportement utilisateur inchangé (reload
  complet conservé).

## Preuves attendues

tsc 0 · eslint 0 err · vitest complet · build prod · probes runtime
(langue compte > cookie vérifiée côté serveur) · ai:check.
