# Analyse d'impact — T-180 (entrée « devenir hôte » pilotée par le rôle)

- **Date** : 2026-09-02
- **Règles** : R7 (un problème → une tâche), R19 (aucun lien mort), zéro
  régression exigée par l'utilisateur.

## Changement

1. **`src/lib/host-entry.ts`** (nouveau, pur, testable) :
   - `hostEntryHref(role)` : `host`/`admin` → `/dashboard/properties/new`
     (**cible historique inchangée**) ; autre ou inconnu → `/inscription?role=host`.
   - `initialRoleFromSearchParam(raw)` : seul `role=host` (casse stricte)
     pré-sélectionne le rôle hôte ; tout le reste → voyageur (défaut sûr).
2. **`src/components/layout/footer.tsx`** : prop **optionnelle** `userRole`
   (`string | null`, défaut `null`) ; le lien `footer.addProperty` pointe
   désormais `hostEntryHref(userRole)`.
3. **`src/app/(main)/layout.tsx`** : passe `user?.role ?? null` au `Footer`.
4. **`src/app/page.tsx`** : idem (usage direct du Footer hors layout `(main)`).
5. **`src/app/(auth)/inscription/register-client.tsx`** : `isHost` initialisé
   depuis `?role=host` via l'initializer `useState` existant (client-only,
   même pattern que `referralCode`).

## Impacts et maîtrise du risque

| Surface | Impact | Maîtrise |
|---|---|---|
| Hôte/admin | **Aucun** : `hostEntryHref` conserve la cible dashboard. Probe runtime : 200 sur `/dashboard/properties/new`. | Tests unitaires 1-2/5 |
| Anonyme/voyageur | Lien footer → `/inscription?role=host` (page existante, 200). Trajet désormais explicite. | Probes runtime + tests 3-4/5 |
| Autres consommateurs du Footer | Prop optionnelle → `<Footer />` nu reste valide (comportement = `/inscription?role=host`, aucune 404). | tsc |
| SSR/hydratation | `useState(() => window.location…)` (déjà en place pour `referralCode`) → SSR `false`, hydration client identique. Pas de mismatch. | Pattern existant |
| i18n | **Aucune clé ajoutée** : réutilise `footer.addProperty`, `auth.host`, `auth.traveler`. | `i18n:check` ✅ |
| Sécurité | Pas d'auto-élévation de rôle : la création de compte hôte reste la seule porte (modération conservée). | Revue de conception |
| Rate limits / perf | Aucun appel réseau ajouté ; `hostEntryHref` est O(1) pure. | — |

## Hors périmètre (volontaire)

- Pas de changement du proxy ni des gardes `/dashboard/*` (comportement de
  sécurité sain et souhaité : c'est le **lien** qui était faux, pas la garde).
- Pas de bascule de rôle « upgrade to host » (sujet métier distinct, à
  chiffrer dans une mission dédiée si souhaité).
