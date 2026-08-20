# 🎯 TÂCHE EN COURS

> **Une seule tâche autorisée à la fois.** Toute autre modification en dehors
> du périmètre décrit ici est **refusée**, sauf validation explicite du
> responsable ou tâche de niveau **T** (trivial) documentée en fin de session.

---

## Identifiant

- **ID** : T-001
- **Titre** : Rendre `JWT_SECRET` obligatoire au démarrage
- **Niveau de proportionnalité** : **C (Critique)** — sécurité de l'auth
- **Bug associé** : BUG-001
- **Ouverte le** : 2026-08-20 (Session 3, en attente de démarrage effectif)
- **Prédécesseur** : T-000 v1.2 (framework v1.0.2), en attente de validation

## Contexte

`src/lib/auth.ts:9` utilise aujourd'hui :

```ts
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "mybestbooking-secret-key-2025"
);
```

Ce fallback constitue une **faille P1** : si `JWT_SECRET` n'est pas défini
en production (oubli de variable d'environnement, mauvaise configuration
de déploiement), n'importe qui connaissant le code (public sur GitHub)
peut forger un JWT admin valide. La chaîne fallback est un secret
publiquement lisible dans le dépôt.

## Objectif

Remplacer le fallback par un **`throw` explicite au démarrage** du module
`src/lib/auth.ts` :

```ts
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET is required (see .ai/SECURITY.md)");
}
const JWT_SECRET = new TextEncoder().encode(secret);
```

Le comportement attendu : le serveur Next.js refuse de démarrer si
`JWT_SECRET` n'est pas fourni. Un fail-fast au boot est infiniment
préférable à une faille silencieuse.

## Périmètre autorisé

- ✅ Modifier `src/lib/auth.ts` (uniquement la partie chargement du secret).
- ✅ Documenter la variable dans `DEV_ENVIRONMENT.md` si ce n'est pas
  déjà fait (à vérifier au moment de l'implémentation).
- ✅ Créer `.env.example` s'il n'existe pas (T-001 le rend nécessaire).
- ✅ Mettre à jour `SECURITY.md` — la P1 devient un point réglé.
- ✅ Mettre à jour `BUGS.md` — BUG-001 passe à `CORRIGÉ (VALIDÉ)`.
- ❌ **Ne pas toucher** à la logique JWT elle-même (`SignJWT`, `jwtVerify`).
- ❌ **Ne pas modifier** le schéma DB.
- ❌ **Ne pas** exécuter `POST /api/seed` (elle réécrirait la DB).

## Rituels obligatoires — niveau C

Conformément à §15.0 et §15.0-bis, T-001 déclenche le **cycle complet** :

- [ ] **§14 Analyse d'impact** dans `REPORTS/analyse_impact_2026-08-20_jwt_secret.md`
  (les 9 questions).
- [ ] **§15.1 Conception** dans `REPORTS/analyse_conception_2026-08-20_jwt_secret.md`
  (options : `throw`, `assert`, `process.exit`, valeur de fallback dev-only ; option
  retenue ; alternatives écartées ; migration).
- [ ] **§15.2 Débat multi-rôles** dans
  `REPORTS/debat_technique_2026-08-20_jwt_secret.md` (11 rôles, voir
  `PROMPTS/roles.md`, chaque rôle 3-5 lignes, objections bloquantes
  résolues).
- [ ] **ADR-003_JWT_Secret_Obligatoire.md** (§11, §15.0).
- [ ] **§13.5 Double validation** : implémentation + test automatisé
  indépendant validant le comportement (le test doit être écrit à partir
  du contrat, pas dérivé du même raisonnement que l'implémentation).

## Critères d'acceptation (§13, §16)

Chaque critère porte un tag §16.

- [ ] 🔍 `src/lib/auth.ts` ne contient plus la chaîne
  `"mybestbooking-secret-key-2025"`.
- [ ] 🔍 Un `throw new Error(...)` explicite au chargement du module si
  `JWT_SECRET` n'est pas défini.
- [ ] 🔨 `npm run typecheck` passe.
- [ ] 🔨 `npm run build` passe **avec `JWT_SECRET` défini**.
- [ ] ▶️ `npm run build` échoue **sans `JWT_SECRET` défini**, avec un
  message d'erreur clair mentionnant la variable et pointant sur
  `.ai/SECURITY.md`.
- [ ] 🧪 Test automatisé (Vitest ou équivalent minimal si J1 pas encore
  livré) qui vérifie le comportement dans les deux cas — **§13.5 double
  validation**.
- [ ] ▶️ `npm run ai:check` continue de passer (11 OK · warnings tolérés
  · 0 fail).
- [ ] 🔍 `.env.example` existe et documente `JWT_SECRET` avec
  `openssl rand -hex 32` en commentaire.
- [ ] 🔍 `SECURITY.md` : BUG-001 marqué corrigé.
- [ ] 🔍 `BUGS.md` : BUG-001 déplacé en « Corrigés » avec la date.
- [ ] 🔍 `TRACEABILITY.md` : ligne T-001 avec preuves 🔨/🧪/▶️.
- [ ] 🔍 `STATE.md` mis à jour.
- [ ] 🔍 `PROGRESS.md` : entrée Session 4.

## Statut

**PLANIFIÉ** — attente de deux préalables :

1. Validation par le responsable de T-000 v1.2 (framework v1.0.2) pour
   consolider le socle avant de l'utiliser.
2. Feu vert explicite du responsable pour démarrer T-001 (les tâches de
   niveau **C** exigent validation préalable §12 + MISSION §7).

Le simple fait d'ouvrir `CURRENT_TASK.md` ne démarre pas les travaux.

## Prochaine tâche prévue

Après clôture VALIDÉ de T-001 :

- **T-002** : protection de `POST /api/seed` (BUG-002, niveau **C**).
  Suggestion de conception : `if (process.env.NODE_ENV === "production") return 404`
  ou header token `x-seed-token` vérifié contre une env var. À arbitrer
  en analyse de conception dédiée.

---

**Rappel** : quand cette tâche est clôturée par le responsable, remplacer
l'intégralité de ce fichier par la description de la tâche suivante. Ne
jamais laisser deux tâches ouvertes ici en même temps.
