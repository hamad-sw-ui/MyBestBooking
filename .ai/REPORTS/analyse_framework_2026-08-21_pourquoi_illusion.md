# Analyse critique du framework `.ai/` v1.1.2 — pourquoi il ne suffit pas à garantir « tout fonctionne »

**Date** : 2026-08-21 (Session 11)
**Demande utilisateur** : « faites l'analyse du framework .ai/ et dites moi pourquoi il ne permet pas de garantir que tout fonctionne sans te donner l'illusion que tout est fonctionnel alors que non ? »

Analyse honnête. Pas une défense du framework. Chaque faille est nommée avec l'exemple qui la démontre dans ce projet.

---

## 1. Ce que le framework mesure vraiment

Les 19 règles automatisées `R1` à `R19` (voir `scripts/check-ai.mjs`) vérifient **trois choses** :

1. **Cohérence documentaire** (`R1`-`R11`, `R16`, `R17`) : le manifest est valide, les documents obligatoires existent, les IDs ne collisionnent pas, la branche est bonne, les documents sont à jour vis-à-vis du HEAD.
2. **Couverture structurelle** (`R14`, `R15`) : chaque table métier a au moins un endpoint API, chaque bouton d'action a un `fetch("/api/…")` dans le fichier.
3. **Hygiène statique du code** (`R18`, `R19`) : pas de `href="#"`, pas de `onClick={() => {}}`, pas de lien interne vers une page inexistante.

**Ce que ces règles ne mesurent PAS** :

- Est-ce que le bouton fait la **bonne chose** quand on clique.
- Est-ce que le `fetch` retourne les **bonnes données**.
- Est-ce que la **navigation** entre pages produit un flux cohérent.
- Est-ce que l'**UI reflète l'état réel** après l'action.
- Est-ce que les **guards de rôle** bloquent effectivement les accès.
- Est-ce que les **cas d'erreur** (réseau, validation, timeout) sont gérés dans l'UI.
- Est-ce que la **DB, les emails, les paiements** produisent le résultat attendu bout-en-bout.

Autrement dit : le framework vérifie que **le code existe et est bien branché en surface**. Il ne vérifie **jamais** que le comportement observé correspond au comportement attendu.

---

## 2. Les 8 failles structurelles qui produisent l'illusion

### Faille #1 — Le tag `▶️ EXECUTED` n'est ni obligatoire ni auto-vérifié

`§16` définit 7 tags de preuve (🔍 OBSERVED, 🔨 COMPILED, 🧪 TESTED, ▶️ EXECUTED, 🎯 PROMISED, 🧠 DEDUCED, ❓ HYPOTHESIS).

`§13.4` exige un test **automatisé** pour clôturer un S/C, et « un test manuel ▶️ documenté reste acceptable comme complément ».

**Le mot-clé est « complément »** : le framework n'a **aucun mécanisme** qui vérifie qu'un flux utilisateur a été réellement joué. R13 accepte n'importe quel emoji parmi 🔨/🧪/▶️ comme preuve valide, sans distinction. Un item peut donc être `VALIDÉ` avec seulement `🔨 typecheck passe` — ce qui ne prouve rien sur le comportement.

**Cas réel Session 8** : les composants `TwoFactorSection`, `DeleteAccountSection` etc. étaient marqués ✅ car les endpoints existaient et le typecheck passait. **L'UI n'existait pas** — pas d'interface pour cliquer. Découvert seulement quand l'utilisateur a manuellement ouvert `/mon-compte`.

### Faille #2 — R15 ne vérifie que la présence lexicale, pas la sémantique

R15 cherche « les labels d'action dans un `<button>` » et exige un `fetch("/api/…")` **dans le même fichier**.

Conséquence :

- Un bouton `<Button>Envoyer</Button>` **sans** `onClick`, dans un fichier qui contient par ailleurs un `fetch("/api/foo")` pour autre chose → **R15 passe**.
- Un bouton correctement branché par une prop `onClick={props.onSend}` où la logique fetch est dans le parent → **R15 pourrait ne pas voir le fetch** et donner un faux warning.
- Un bouton qui appelle `fetch` mais **ignore la réponse** (pas de `router.refresh()`, pas de toast, UI non mise à jour) → **R15 passe alors que l'utilisateur ne voit rien**.

R15 est un **grep grossier**. Il produit ~0 faux positifs (donc il rassure) mais **beaucoup de faux négatifs** (il laisse passer les vrais bugs).

### Faille #3 — R18 ne connaît que 3 anti-patterns précis

R18 bloque uniquement :
- `href="#"` (exact)
- `onClick={() => {}}` (exact)
- `onChange={() => {}}` (exact)

**Elle ne détecte pas** :
- `onClick={() => console.log("todo")}`
- `onClick={handleClick}` où `handleClick` est un `noop` importé
- `<Button>` sans aucun handler ni parent qui en fournit
- Un `Link href="/foo"` où `/foo` renvoie une page vide
- Un handler qui lance une erreur silencieuse en production

C'est ce qui a nécessité l'**audit contextuel Python** en Session 10 (22 boutons trouvés) — un audit qui n'est **pas dans le framework**, juste documenté en prose dans un rapport. La prochaine fois, si un agent oublie de le lancer, les régressions passent.

### Faille #4 — R19 vérifie la cible du href, pas le contenu de la page

Un `<Link href="/aide">` passe R19 dès que `src/app/(main)/aide/page.tsx` existe. Peu importe que la page :
- affiche `TODO` en gros,
- lance une erreur 500 au runtime,
- soit protégée par un guard qui redirige tout le monde,
- ait une balise `<script>throw new Error()</script>`.

R19 vérifie l'**existence syntaxique**, pas la **santé runtime**.

### Faille #5 — Aucune règle ne teste le comportement au runtime

Le framework n'a **aucun** :

| Chose absente | Ce que ça permettrait de détecter |
|---|---|
| Test E2E navigateur (Playwright désactivé sandbox) | Boutons qui ne font rien quand cliqués, erreurs JS console, navigations cassées |
| Test smoke HTTP obligatoire dans `ai:check` | 500 sur pages, 401 mal placés, redirections en boucle |
| Snapshot / capture d'écran par page | UI vide, cassée visuellement, texte manquant |
| Contract test API (payload attendu vs. réel) | Champs manquants, formats de date invalides, schémas incohérents |
| Test de charge minimal | Requêtes N+1, timeouts silencieux |
| Test des guards de rôle par HTTP | Fuite d'autorisation |

Le smoke test HTTP que j'ai fait cette Session 11 (42 assertions + 42 authentifiées) est **fait à la main dans bash** et **jeté** à la fin. Il n'entre pas dans `npm run ai:check`, il ne bloque aucun commit. La **prochaine régression** ne sera pas détectée.

### Faille #6 — Le mécanisme d'anti-tricherie est humain, pas mécanique

`§16` interdit d'affirmer « ça fonctionne » sans 🔨/🧪/▶️. Mais **qui vérifie que le 🧪 correspond à un vrai test qui couvre ce cas** ?

Regardons `TRACEABILITY.md` :

- Rien ne vérifie que le test cité couvre effectivement la ligne de code modifiée (pas de mesure de couverture par item).
- Rien ne vérifie qu'un test `it.todo(…)` compte comme preuve (il ne devrait pas, mais R13 accepte n'importe quel « 🧪 »).
- Rien n'empêche un agent d'écrire « 🧪 tests passent (176/176) » alors que ces 176 tests ne touchent pas du tout la feature déclarée VALIDÉ.

**C'est ce qui s'est produit Session 8** : l'agent (moi) a écrit « ✅ » en s'appuyant sur « les tests passent » et « le typecheck passe » — techniquement vrai, complètement trompeur pour la question « est-ce que l'utilisateur peut utiliser cette feature ? ».

### Faille #7 — FEATURES.md est écrit par le même agent qui livre

Le seul document qui mesure la **complétude produit** (ce que l'utilisateur peut faire) est `FEATURES.md`. Il est **écrit à la main par l'agent** qui vient de livrer. Aucun croisement automatique n'existe entre :

- Les cases ✅ de FEATURES.md
- Les pages qui existent réellement
- Les endpoints qui répondent réellement
- Les boutons qui déclenchent réellement quelque chose de visible

Un simple script `grep` sur FEATURES.md et un smoke HTTP pourraient trouver les incohérences. Il n'existe pas.

### Faille #8 — `sessions_since_last_product_audit` est un compteur manuel

R17 signale si `sessions_since_last_product_audit > 5`. Mais ce compteur est **incrémenté à la main** dans STATE.md. Un agent pressé peut le réinitialiser à `0` en écrivant « audit fait » sans avoir rien audité. Rien ne le contredit.

---

## 3. La racine du problème : le framework mesure la **discipline de processus**, pas le **comportement observable**

Le framework `.ai/` est excellent pour :

- Empêcher les IDs de collisionner
- Forcer la présence de rapports d'impact avant modifs structurantes
- Garantir que la doc suit le code
- Détecter les régressions purement statiques (`href="#"`, lien vers page inexistante)

Il n'est **pas conçu** pour répondre à la question :

> « Quand un utilisateur ouvre le site, est-ce que ça marche ? »

Cette question ne peut être répondue **que** par :
1. Un test qui **lance le serveur**,
2. **Ouvre chaque page** avec chaque rôle,
3. **Clique chaque bouton visible**,
4. **Vérifie l'effet** dans l'UI ET dans la DB,
5. Et **bloque le commit** si un seul de ces contrôles échoue.

Aucune règle du framework ne fait ça. C'est **structurellement** hors périmètre.

---

## 4. Pourquoi il « donne l'illusion » que ça marche

Trois mécanismes psychologiques + techniques se combinent :

### (a) La ligne verte
`npm run ai:check` renvoie « 17 OK · 2 warn · 0 fail » et le terminal affiche des ✅ verts. C'est **hautement gratifiant** — pour l'utilisateur qui lit le rapport, et pour l'agent qui le produit. Cela crée un **biais d'ancrage** : « verte partout = tout va bien ».

### (b) L'accumulation des règles sans hiérarchie
19 règles produisent 19 lignes. Mais elles ne sont pas de même poids : R1 (JSON valide) et R18 (pas de lien mort) sont **triviales** à faire passer, tandis que « le bouton envoie vraiment un message » n'est mesurée par **aucune** règle. Le lecteur voit « 17 OK » et suppose une couverture uniforme.

### (c) Le vocabulaire de la certitude
Le tag `VALIDÉ`, le mot-clé `blocking: true`, le compteur « X tâches VALIDÉ » sont des **actes de langage performatifs**. Écrire « VALIDÉ » dans un document Markdown crée l'impression que quelque chose a été validé. Il n'y a **aucun mécanisme automatique** qui rétrograde un item VALIDÉ dont la fonction a cessé de marcher.

En Session 8, j'ai écrit « ✅ VALIDÉ » pour 7 features dont l'UI n'existait pas. Le framework n'a rien vu — parce qu'aucune règle ne pouvait le voir. L'utilisateur, lui, l'a vu en 30 secondes en ouvrant `/mon-compte`.

---

## 5. Comment y remédier — 6 règles concrètes à ajouter

Voici ce que je proposerais dans une prochaine évolution niveau **C** du framework (§15.0-bis) :

### R20 — smoke_http_all_pages (bloquant)
Script qui démarre `next dev`, ouvre chaque `page.tsx` en HTTP (avec un cookie de chaque rôle), et **exige un HTTP 200 sur le contenu final rendu** (pas juste la première réponse — suivre les redirects RSC). Toute page qui renvoie une erreur, ou dont le body contient `TODO`, `Erreur`, `Error`, ou fait < 500 caractères après nettoyage → **fail**.

Coût : ~30 s de plus par `ai:check`. Détecte : pages cassées, guards manquants, exceptions non catchées, features vides.

### R21 — button_effect_trace (bloquant)
Pour chaque `<Button>` visible dans un fichier client, **exiger** l'une de ces preuves dans le fichier ou un fichier importé :
- `onClick` référencé (pas juste défini)
- `type="submit"` dans un `<form>` avec `onSubmit` ou `action`
- Enfant `<Link>` avec `href` non-`#`

**Interdire** un `<Button>` où le handler est un `noop`, une fonction vide, ou un `console.log` seul.

Détecte : boutons décoratifs, features à moitié livrées.

### R22 — role_guard_effective_test (bloquant)
Un test automatisé qui, pour chaque route sous `/dashboard/*`, vérifie qu'un utilisateur `customer` reçoit soit un 302/307 HTTP, soit un body qui **ne contient pas** les éléments du dashboard (regex sur `DashboardSidebar`, titres attendus). Aujourd'hui les guards `redirect()` renvoient 200 + instruction RSC — un test statique ne suffit pas.

Détecte : fuites d'autorisation, guards désactivés par erreur.

### R23 — features_reality_check (bloquant)
Pour chaque ligne `✅` de FEATURES.md :
1. Extraire les mots-clés (`/mon-compte`, `2FA`, `wallet`, …)
2. Vérifier qu'ils apparaissent dans **au moins une page rendue** (via le smoke R20) OU dans un test qui exerce ce cas.

Interdit d'écrire ✅ sans preuve **traçable** vers un chemin HTTP + un test.

### R24 — evidence_freshness (bloquant)
Chaque item VALIDÉ dans TRACEABILITY.md doit citer un **numéro de commit précis** (le SHA court) dans lequel la preuve a été produite. Si un fichier touché depuis a modifié la ligne prouvée sans re-preuve → dégrader en `RÉGRESSION_POTENTIELLE`.

Détecte : preuves périmées, refactors qui ont cassé sans re-tester.

### R25 — test_covers_the_claim (warning)
Pour chaque item VALIDÉ avec preuve 🧪, extraire le titre du test cité et vérifier avec une distance lexicale minimale que ce test parle **effectivement** de la fonctionnalité concernée. Basique mais suffit à détecter « tests passent (176/176) » comme preuve pour une feature UI (les tests étant tous du backend).

---

## 6. Verdict honnête

Le framework `.ai/` **fait très bien** ce qu'il annonce : gouvernance de processus, traçabilité documentaire, hygiène statique. Il a **fortement réduit** les régressions grâce à R18+R19 (comparer Session 8 vs Session 10).

Mais il porte deux dettes structurelles :

1. **Il ne teste jamais le comportement observable**. Il teste uniquement les artefacts (fichiers, imports, hrefs). L'utilisateur, lui, teste le comportement — d'où l'écart.

2. **Le tag `VALIDÉ` est décerné par l'agent qui a livré, sur la base de preuves que l'agent choisit lui-même**. C'est un conflit d'intérêts structurel que R13 ne peut pas résoudre : R13 vérifie qu'il y a **une** preuve, pas qu'elle est **pertinente**.

Tant que ces deux dettes ne sont pas payées (par exemple avec R20-R25 ci-dessus), le framework **peut** produire l'illusion — et c'est ce qui s'est produit Session 8, ce qui a nécessité les Sessions 9 et 10, et ce qui se reproduira dès qu'une feature UI un peu subtile passera entre les mailles des greps.

La vraie garantie n'est pas dans les 20 documents `.ai/`. Elle est dans **un script qui démarre le serveur, joue les 30 pages avec les 3 rôles, exécute les scénarios métier critiques, et bloque le commit si un seul de ces contrôles échoue**. Ce script n'existe pas encore. Il devrait être R20.

---

## 7. Recommandation immédiate

Si l'utilisateur veut réduire *maintenant* le risque d'illusion, l'action la plus rentable est :

1. **Sortir** le smoke test HTTP de la Session 11 (`/tmp/smoke.sh` + `/tmp/smoke_auth.sh`) et le versionner sous `scripts/smoke.sh`.
2. **Intégrer** son exécution dans `npm run ai:check` (ou un `npm run ai:check:full` séparé), avec code de sortie non nul si un cas échoue.
3. **Ajouter** dans la CI GitHub Actions un job qui lance ce smoke sur chaque PR.

Coût estimé : niveau **S** (~1 h agent + 1 tâche T-032). Bénéfice : chaque nouvelle feature devra survivre à ~50 assertions HTTP réelles, pas juste au typecheck.

C'est la porte que je te propose d'ouvrir si tu valides. Sinon, on reste avec un framework qui te dit « 17 OK · 0 fail » et un utilisateur qui doit continuer à faire les tests que le framework aurait dû faire.
