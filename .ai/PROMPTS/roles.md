# Prompt — débat multi-rôles (PRESCRIT §15.2)

À utiliser pour toute décision technique de niveau **C**, ou de niveau **S**
en cas de désaccord initial.

Chaque rôle raisonne **indépendamment** en 3 à 5 lignes. Chacun a le droit
(et le devoir) d'émettre une **objection bloquante** si sa perspective
détecte un risque. Le débat entier est consigné dans
`REPORTS/debat_technique_<date>_<sujet>.md`.

---

## Rôles

### 1. Architecte
- **Question directrice** : la solution respecte-t-elle l'architecture
  cible (`ARCHITECTURE.md`) ? Introduit-elle une dépendance transverse
  non prévue ?
- **Objection typique** : couplage nouveau entre deux couches jusque-là
  séparées.

### 2. Développeur Next.js senior
- **Question directrice** : est-ce idiomatique de l'App Router 16 ?
  RSC/Client, Server Actions vs route handlers, `cookies()`/`params`
  asynchrones ?
- **Objection typique** : `"use client"` posé alors qu'un RSC ferait
  l'affaire ; `useEffect` qui refetch en boucle.

### 3. Expert TypeScript
- **Question directrice** : les types sont-ils précis ? Y a-t-il des `any`,
  des assertions dangereuses (`as unknown as T`), des `!` non-null qui
  masquent une invariance ?
- **Objection typique** : type dérivé à la main quand `typeof table.$inferSelect`
  ferait mieux.

### 4. Expert React (RSC / Client)
- **Question directrice** : cohérence RSC ↔ Client. Frontière server/client
  claire ? Streaming et `<Suspense>` bien placés ? Erreurs bien gérées avec
  `error.tsx` ?
- **Objection typique** : donnée sensible passée du serveur au client dans
  les props d'un composant client.

### 5. Expert Drizzle / SQL
- **Question directrice** : la requête est-elle typée, paramétrée, sans N+1 ?
  Utilise-t-elle les index existants ? Les jointures sont-elles nécessaires ?
- **Objection typique** : boucle `Promise.all` là où un `LEFT JOIN` suffit.

### 6. Expert PostgreSQL
- **Question directrice** : indexation, contraintes, `NULL`, transactions
  atomiques, isolation, verrous ? La migration est-elle idempotente et
  rollbackable ?
- **Objection typique** : `UPDATE ... SET averageRating = ...` sans
  transaction → race condition.

### 7. Expert sécurité web
- **Question directrice** : nouvelle surface d'attaque ? Élévation de
  privilèges possible ? Cookie mal configuré ? CSRF ? Injection ?
  Rate-limiting ? Secrets bien isolés ?
- **Objection typique** : nouveau endpoint qui accepte du HTML sans
  échappement, ou qui expose `passwordHash`.

### 8. Ingénieur QA
- **Question directrice** : comment tester ce changement ? Cas nominaux,
  cas d'erreur, cas limites, régressions possibles ? Fixtures et
  déterminisme ?
- **Objection typique** : le fix n'a pas de test de non-régression alors
  que le bug est arrivé deux fois.

### 9. DevOps / SRE
- **Question directrice** : impact runtime (mémoire, connexions DB, cold
  start), logs exploitables, observabilité, rollback simple ? Nouvelles env
  vars documentées ?
- **Objection typique** : le pool `pg` va exploser sous charge parce que
  chaque requête ouvre une connexion.

### 10. Expert UX / a11y
- **Question directrice** : parcours utilisateur cohérent, messages en
  français corrects, focus visible, contraste AA, mobile OK, erreurs
  actionnables ?
- **Objection typique** : bouton icône-seul sans `aria-label`, formulaire
  qui ne dit pas ce qui a échoué.

### 11. Relecteur (advocatus diaboli)
- **Rôle** : chercher **activement** les défauts que les 10 autres n'ont
  pas vus. Poser les questions gênantes : et si l'utilisateur double-clique ?
  Et si la DB est down ? Et si on redéploie au milieu d'une transaction ?
- **Objection typique** : « le code fait ce qui est écrit, mais est-ce ce
  qu'on veut vraiment ? »

---

## Règles du débat

1. **Chaque rôle s'exprime.** On ne saute pas un rôle sous prétexte qu'il
   « n'aurait rien à dire ». S'il n'a rien à dire, il l'écrit :
   « RAS pour ce rôle sur cette décision. »
2. **Les objections bloquantes** doivent être **résolues explicitement**
   avant décision : soit acceptées (le design change), soit rejetées avec
   argument tracé.
3. **Décision finale** consignée à la fin du rapport, signée par le
   responsable.
4. **Le rôle Relecteur** parle en dernier — c'est sa fonction.

## Format du rapport `debat_technique_<date>_<sujet>.md`

```markdown
# Débat technique — <sujet>

- **Date** : YYYY-MM-DD
- **Tâche** : B-xxx
- **Niveau** : C | S (désaccord)
- **Proposition initiale** : <résumé 3 lignes>

## Rôle 1 — Architecte
<avis>

## Rôle 2 — Développeur Next.js senior
<avis>

... (rôles 3 à 11)

## Objections bloquantes
- Rôle X : <objection> — Résolution : <accepté | rejeté + argument>

## Décision finale
<décision, signée par <responsable>>
```
