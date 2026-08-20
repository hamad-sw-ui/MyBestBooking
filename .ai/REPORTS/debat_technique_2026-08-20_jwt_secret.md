# Débat technique — T-001 : JWT_SECRET obligatoire

- **Date** : 2026-08-20 (Session 4)
- **Tâche** : T-001 (BUG-001)
- **Niveau** : C
- **Proposition initiale** : Option A du rapport de conception —
  `throw` au chargement du module `src/lib/auth.ts` si `JWT_SECRET`
  n'est pas défini.

---

## Rôle 1 — Architecte

Cohérent avec `SECURITY.md` (P1 #1) et `CODING_RULES §4`. Le fail-fast
au démarrage est le pattern standard pour les invariants critiques. Le
module `auth.ts` reste la seule frontière avec le mécanisme JWT, aucun
couplage introduit. **RAS.**

## Rôle 2 — Développeur Next.js senior

Un `throw` au top-level d'un module est **exécuté par Next.js au moment
du bundling** pour les modules importés dans les routes RSC. Cela veut
dire que `next build` échoue proprement si `JWT_SECRET` est absent —
comportement voulu, standard chez Next depuis la v13. Attention : si un
jour on active le Edge Runtime pour une route, `process.env.JWT_SECRET`
doit être disponible côté edge (Vercel Edge fournit
`process.env` correctement, pas d'inquiétude à ce stade). **RAS.**

## Rôle 3 — Expert TypeScript

Le patch fait passer `JWT_SECRET` de type `Uint8Array` (avec `||
"fallback"`) à `Uint8Array` (après check). Aucun changement de type
public. Ajouter éventuellement une assertion `secret satisfies string`
pour la clarté — non bloquant.

## Rôle 4 — Expert React (RSC / Client)

`auth.ts` n'est **jamais** importé côté client (bien : il utilise
`bcrypt` et `pg` via `db`, ce qui casserait le build client). Vérifier
que `.env.local` n'expose pas `JWT_SECRET` via un préfixe
`NEXT_PUBLIC_*` — **c'est déjà le cas** dans `.env.local` créé
Session 3. **RAS.**

## Rôle 5 — Expert Drizzle / SQL

Aucun impact schéma. Aucun impact requête. **RAS.**

## Rôle 6 — Expert PostgreSQL

Aucun impact base. **RAS.**

## Rôle 7 — Expert sécurité web (auth, cookies, CSP)

**Décision saine.** Trois observations complémentaires — hors périmètre
T-001 mais à tracer :

1. **Le secret dérive une clé HMAC-SHA256** (via `jose` HS256). 32
   octets aléatoires minimum recommandés. `.env.example` doit inclure
   `openssl rand -hex 32` en commentaire.
2. **Aucune rotation prévue.** Un JWT signé aujourd'hui reste valide
   30 jours. Une future rotation de secret invalide toutes les
   sessions — acceptable. À noter dans `KNOWN_LIMITATIONS.md`.
3. **Le secret est logué au démarrage par Next** en cas de crash
   (`Uncaught Error`) uniquement s'il est **inclus** dans le message.
   Vérifier que le message d'erreur ne contient **pas** la valeur du
   secret. Le patch proposé ne l'inclut pas — OK.

## Rôle 8 — Ingénieur QA

**Objection bloquante** : le test §13.5 double validation doit tester
**les deux cas** (défini / absent). Un seul test « le module charge »
ne prouve rien. La conception prévoit déjà les 2 cas → **résolue**.

Ajouter un test qui vérifie que le **message** d'erreur mentionne
`JWT_SECRET` (aide au diagnostic).

## Rôle 9 — DevOps / SRE

`npm start` échouera dès qu'un container manquera la variable → **très
bien**. Prévoir dans `avant_release.md` un check explicite au dernier
moment (déjà présent). Attention à Vercel : si `JWT_SECRET` est
uniquement défini pour `Production` et pas `Preview`, les branches PR
casseront — à documenter.

## Rôle 10 — Expert UX / a11y

**RAS** — aucun impact utilisateur final. Le seul « utilisateur » qui
verra un changement est l'ops qui déploie sans la variable, et il verra
un message clair. C'est de la bonne UX ops.

## Rôle 11 — Relecteur (advocatus diaboli)

Trois questions gênantes :

1. **Et si `JWT_SECRET` est défini mais vaut la chaîne vide ?**
   `process.env.JWT_SECRET || fallback` traite `""` comme falsy, donc
   `!secret` aussi → le throw se déclenche. **OK.**
2. **Et si quelqu'un met `JWT_SECRET="undefined"` par erreur ?**
   Le check `!secret` ne détecte pas ce cas — le serveur démarre avec
   un secret de 9 caractères, vulnérable au brute force. Nice-to-have :
   ajouter un warning si `secret.length < 32`, sans throw. **À
   ajouter au patch.**
3. **Et si le module est importé par un test qui n'a pas les env vars ?**
   → le test échoue à l'import avec l'erreur du throw. C'est
   volontaire (l'auteur du test voit tout de suite ce qu'il manque).
   Le `vitest.config.ts` ou `.env.test` peut fournir les variables. **OK.**

**Recommandation** : intégrer le warning point 2 dans le patch.

---

## Objections bloquantes

| Rôle | Objection | Résolution |
|---|---|---|
| QA | Test doit couvrir les 2 cas | Résolue par la conception, prévue dans le plan d'implémentation |
| Relecteur | Warning si secret trop court | **Accepté**, ajouté au patch : `if (secret.length < 32) console.warn(...)` |

## Décision finale

**Option A retenue**, patch enrichi du warning `< 32` proposé par le
Relecteur. Test §13.5 couvre les 2 cas + le message d'erreur.

Signée par : responsable du projet (validation-cadre du 2026-08-20
« terminer selon le framework »).
