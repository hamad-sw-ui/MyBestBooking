# Analyse de conception — T-221 → T-231 (audit n°2) + T-242 → T-244 (audit n°4)

- **Date** : 2026-09-10
- **Niveau** : **C (critique)**.
- **Entrées** : impact `REPORTS/analyse_impact_T-221_2026-09-10_mise_en_oeuvre_audits.md`,
  analyses d'audit `docs/analyse_2026-09-10_audit_runtime_inacheves.md` (A1→A11) et
  `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (N1→N3).

## 1. Principe directeur

Chaque correctif suit la même règle : **la vérité métier reste à un seul endroit** (le tunnel de
réservation pour le stock, `deleted_at`/`suspended_at` pour l'état du compte, le TOTP pour le second
facteur), et les nouvelles surfaces se contentent de **lire** cette vérité — jamais de la recalculer
différemment. Les contrôles ajoutés refusent une entrée incohérente (`400`/`403`/`409`) plutôt que de
la réparer silencieusement.

## 2. Décisions de conception

### 2.1 A10 — `suspended_at` distinct de `deleted_at` (migration `0021`)

Deux états différents partageaient une colonne. Le choix retenu : **ajouter** `suspended_at` +
`suspended_reason` et **migrer** les suspensions existantes (lignes où `deleted_at` est renseigné
sans e-mail anonymisé `deleted-…@anonymized.local`), plutôt que de renommer `deleted_at` — ainsi
l'anonymisation et la suppression restent inchangées, et aucune clé étrangère ni code de lecture
`deleted_at` n'est retouché.

*Alternative écartée* : interpréter `deleted_at` selon le contexte (un état = un booléen calculé).
Elle laissait le même trou — impossible de dire « suspension » d'un compte effacé.

### 2.2 A11 — codes de secours (hachés, à usage unique)

- Génération de 10 codes `XXXXX-XXXXX` sur un alphabet sans caractères ambigus
  (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`) : une saisie humaine ne doit pas échouer sur `0/O` ou `1/I/L`.
- **Stockage haché** (bcrypt) sous `[{hash, usedAt}]` en jsonb : la base ne permet jamais de
  reconstituer un code. La liste n'est affichée qu'au moment de la génération (réponse de
  `2fa/verify`) puis devient irrécupérable — comportement standard, et seule garantie que le second
  facteur n'est pas affaibli par un secret lisible en base.
- **Usage unique** : le code consommé est marqué (`usedAt`) dans la requête qui l'accepte. Un code
  déjà utilisé renvoie un message dédié (« déjà utilisé ») plutôt que « invalide », pour que
  l'utilisateur comprenne qu'il doit prendre le suivant.
- **Deux portes de sortie** : la connexion (`login` avec `totpCode` sous forme de code de secours)
  **et** la désactivation (`2fa/disable`), car ne pouvoir que se connecter ne suffit pas à récupérer
  son compte durablement.
- **Dernier recours** : `POST /api/users/[id]/two-factor/reset` (admin), qui révoque le facteur,
  **coupe les sessions** (un facteur potentiellement fuité ne doit pas survivre) et prévient
  l'intéressé par e-mail ; l'action est tracée `user.2fa.reset`.

### 2.3 T-242 — anonymisation transactionnelle

Une fonction unique (`anonymizeUserAccount(tx, …)`) exécute les cinq opérations **dans la
transaction** de `DELETE /api/users/me` : `users`, `bookings.guest_*`, `email_outbox.to`,
`audit_log.metadata.targetEmail` (via `jsonb_set`) et suppression des sessions. Le choix
« tout ou rien » évite l'état intermédiaire où le compte est anonymisé mais ses copies visibles.
*Alternatives écartées* : masquage à la lecture (n'efface rien, dépend de la discipline de chaque
lecteur) et suppression des lignes comptables (casserait les factures et les obligations légales).

### 2.4 T-243 — purge technique bornée

`purgeTechnicalData(now)` purge **uniquement** ce qui n'a aucune valeur métier : sessions expirées
depuis plus de 7 jours, lignes `email_outbox` `sent|failed` de plus de 90 jours. Les lignes
`pending`/`sending` sont toujours conservées (les purger perdrait des e-mails non partis) et
`audit_log` **n'est jamais purgé** — la fonction ne fait que remonter une mesure (`auditRows`,
`oldestAuditAt`) pour rendre la décision de rétention explicite.

### 2.5 T-244 — « Reste vendable » sans dupliquer la règle

`remainingStock(déclaré, capacité, réservés) = max(0, min(déclaré, capacité) − réservés)` vit dans un
module **pur** (`room-stock-rules.ts`) importable par un composant client ; le calcul SQL des séjours
chevauchants vit dans `room-stock.ts` (serveur). L'API renvoie un champ **additif** `bookedCounts` ;
l'affichage devient « reste X (Y réservé) ». Le tunnel de réservation reste l'autorité : l'affichage
ne décide jamais d'une vente.

### 2.6 A7/A8 — valider ce que l'on persiste

- Horaires : format `HH:MM` en entrée, fuseau vérifié via `Intl` (`isValidTimezone`), et **validation
  sur l'état résultant** d'un PUT partiel (fusion avec la valeur persistée) : sinon une mise à jour
  partielle pouvait produire une fenêtre vide (`début = fin`). Les fenêtres traversant minuit
  (`18:00 → 02:00`) restent acceptées.
- Labels (`isEcoCertified`, `isBestrewards`, `isPreferred`) : décision éditoriale de la plateforme —
  `403` pour un hôte en **PUT et POST** (en POST, refus explicite plutôt qu'ignorance silencieuse).
  `isBestrewards` majore la remise BestRewards : un hôte ne peut pas s'auto-attribuer une remise.

### 2.7 A1/A2/A5/A6/A9 et A3/A4 — rendre visible ce qui existait déjà

Échéance de demande affichée (et non plus seulement stockée), vue « À constater » et colonne
« Règlement », notifications d'avis via l'outbox existante (`review-notifications.ts`), édition de
chambre complète (`RoomEditValue`), libellé du fil dépendant de l'acteur (avec masquage admin non
hôte), interrupteurs de notifications et parrainage exposés dans les réglages — chaque ajout
réutilise un mécanisme existant (outbox, audit, FSM, réglages) plutôt que d'en créer un nouveau.

## 3. Ordre de mise en œuvre

A1+A2 → A6+A7+A8 → A3+A4 → A5+A9+A10+A11 → T-242+T-243+T-244, du plus visible pour l'utilisateur au
plus sensible côté données, afin que chaque lot soit vérifiable au runtime avant d'engager le
suivant.

## 4. Stratégie de test

- **Unitaire** : règles pures (`room-stock`, `timezone`, `backup-codes`, `technical-retention`).
- **Intégration DB réelle** : anonymisation (0 occurrence de l'identité + agrégats intacts +
  idempotence), suspension/réactivation/`409`, reset 2FA (purge + sessions + audit), horaires et
  labels d'hébergement.
- **Runtime serveur réel** : parcours 2FA complet (activation → 10 codes → connexion par code →
  refus du même code → seconde connexion → désactivation par code de secours → base purgée),
  suspension d'un hôte puis message de connexion exact, réactivation, `409` sur compte anonymisé,
  fuseau invalide `400`, horaires invalides `400`, fenêtre vide `400`, labels `403` hôte / `200`
  admin, calendrier « reste 2 (1 réservé) ».
- **Non-régression globale** : `npm run ci` (typecheck, lint, i18n, vitest, build, smoke HTTP) et
  `npm run ai:check` (règles du framework).

## 5. Rollback

Chaque volet est isolé : la migration est additive (aucune colonne supprimée, les données migrées
restent lisibles), les refus ajoutés portent sur des entrées qui n'étaient pas validées, et les
nouvelles surfaces sont des champs/écrans additionnels. Revenir en arrière consiste à retirer la
colonne `suspended_at` d'usage et à réutiliser `deleted_at` — sans perte de données comptables.
