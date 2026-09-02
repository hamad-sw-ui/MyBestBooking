# Analyse de conception — T-180 (entrée « devenir hôte » pilotée par le rôle)

- **Date** : 2026-09-02

## Options étudiées

1. **Message explicatif à l'arrivée sur `/`** après le 307 (toast « créez un
   compte hôte ») — rejeté : dans Next 16, `redirect()` dans un RSC avale le
   contexte (leçon T-179) ; transporte un `?from=` → heuristique fragile et
   XSS de surface inutile. Ne corrige pas le cas anonyme.
2. **Bouton « Devenir hôte » qui élève le rôle du compte courant** (PATCH
   self-service) — rejeté : auto-élévation de privilèges, contraire à la
   modération existante (l'admin valide les hébergements ; création de compte
   hôte = porte volontaire).
3. **Lien contextuel + pré-sélection de rôle** (retenu) : le footer pointe
   vers la bonne porte d'entrée selon le rôle, et l'inscription accepte un
   paramètre d'intention `?role=host`. Aucune régression pour hôte/admin,
   coût minimal, testable purement.

## Conception retenue

```text
Footer(userRole) ── hostEntryHref(role) ──┬─ host/admin → /dashboard/properties/new  (inchangé)
                                          └─ autre     → /inscription?role=host
inscription?role=host ── initialRoleFromSearchParam ── isHost=true (pré-coché « Hôte »)
```

- **Pureté** : toute la décision tient dans `host-entry.ts` (fonction pure,
  5 tests, 0 dépendance) — les composants ne font que la brancher.
- **Défaut sûr** : paramètre absent/vide/casse différente/valeur inconnue →
  voyageur. `role=host` exact seul déclenche la pré-sélection.
- **Propagation du rôle** : `user?.role ?? null` passé aux deux seuls sites
  d'instanciation du `Footer` (`(main)/layout.tsx`, `page.tsx`). La prop est
  optionnelle pour ne pas casser d'éventuels futurs usages nus.
- **Choix `?role=`** : pattern déjà utilisé par `referralCode` (initializer
  `useState` client-only) — cohérence interne, zéro nouveau mécanisme.

## Tests associés

`src/lib/host-entry.test.ts` (5) : cible dashboard préservée (host, admin) ;
voyageur/anonyme → inscription ; casse stricte (`HOST` ignoré) ; paramètre
absent/arbitraire → voyageur.

## Limites connues

- Le pré-cochage n'est pas vérifiable par simple grep HTML SSR (initializer
  client) ; il est vérifié par test unitaire de la fonction + probe du href
  par rôle en runtime.
- Les artefacts d'audit (promo `RENTREE2026`, comptes de test) restent en
  base : données à la marge, sans incidence fonctionnelle.
