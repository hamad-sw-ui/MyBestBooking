# Analyse runtime n°6 — pages, boutons et fonctionnalités inachevés ou mal pensés

> Demande du 2026-09-11 (après le gel wallet T-248 §3) : *« analyse profonde des scénarios et éléments fonctionnels du projet à l'exécution (pages, boutons, fonctionnalités…) inachevés et/ou mal pensés ; expliquer le problème et donner leurs solutions sans régression »*.
>
> **Cette passe n'a modifié aucune ligne de code applicatif** : constats, preuves d'exécution et solutions non régressives uniquement. Audit précédent : `docs/analyse_2026-09-11_audit_runtime_execution.md` (n°5, A1→A8, livré dans `d620e98`).
>
> Contexte : branche `arena/01a08b7d-mybestbooking`, HEAD `0508c14`, CI verte (136 fichiers / 778 tests, smoke 95/95). Base rendue au seed avant et après la passe.

## 1. Objet et méthode

Objectif : trouver ce qui, **à l'exécution**, est à moitié branché, trompeur ou invisible — puis proposer pour chaque constat une correction **strictement non régressive** (ce qui fonctionne déjà bien ne doit pas bouger).

| Moyen | Détail |
|---|---|
| Inventaire | **45 pages** (`src/app/**/page.tsx`), **71 routes API** (`src/app/api/**/route.ts`), **11 `loading.tsx`** |
| Balayage des pages | les 21 pages publiques en anonyme + les 21 écrans admin (`/tmp/admin.jar`) + les 4 écrans voyageur (`/tmp/customer.jar`) : **100 % en 200/307 attendus, 0 erreur applicative** |
| Boutons | analyse statique des `<button>` / `<Button>` sans handler, des `<img>` sans `alt`, des `div onClick` sans `role` |
| Textes | détection des nœuds JSX hors `t()` (i18n en dur) |
| Capacités API | confrontation des **90 appels UI** aux routes existantes ; test runtime des paramètres que l'UI n'expose pas (`sort=popularity`, `minRating`, `near`, `search`) |
| Écrans de liste | inventaire `parsePageWindow` / `ShowMore` / `.limit(` des pages serveur (fenêtres et troncatures silencieuses) |
| Modèle de données | confrontation **schéma ↔ API ↔ formulaires d'écriture** (colonnes que personne ne peut remplir) |
| E-mails | lecture de l'`email_outbox` (73 lignes) et des bases d'URL utilisées par chaque gabarit |
| Supervision | insertion d'une trace `cron_runs` datée de −4 h puis lecture de `GET /api/health` (ligne de test supprimée après mesure) |
| Sécurité | détection des routes sans garde apparente (12 → toutes justifiées : auth publique rate-limitée, santé, partages par jeton, stub sans secret) |
| État final | `cron_runs` = 0 (ligne de test supprimée), `email_outbox` = 73 (inchangé), 8 users / 8 properties / 30 bookings / 21 reviews |

## 2. Synthèse des constats

| # | Constat | Type | Sévérité | Vérifié |
|---|---|---|---|---|
| **B1** | La cadence attendue du cron est déclarée **horaire** alors que `vercel.json` le planifie **quotidien** (`0 8 * * *`) : `/dashboard/cron` et `/api/health` affichent « En retard » / `stale` ~21 h sur 24 — fausse alerte permanente | Mal pensé (régression de T-250) | Moyenne | runtime + code |
| **B2** | `/api/cron/payouts` est **planifié** dans `vercel.json` mais n'écrit **aucune trace** (seul `price-alerts` utilise `runWithTrace`) et répond **410 chaque jour** tant que les versements sont désactivés → bruit quotidien invisible dans le produit | Inachevé / hygiène | Moyenne | runtime + code |
| **B3** | Base URL des e-mails : **trois stratégies** cohabitent. Deux sites utilisent `?? ""` (liens **relatifs** dans les e-mails de rappel d'avis et de message) et cinq sites `?? "http://localhost:3000"` (liens **localhost** dans les e-mails de vérification de compte), alors que `lib/app-url.ts` (T-165) centralise le repli absolu | Mal pensé | **Haute** | code + outbox |
| **B4** | Fenêtres de liste : `parsePageWindow` + `ShowMore` couvrent 7 écrans, mais **`/dashboard/messages`** et **`/dashboard/rooms`** chargent encore tout — et la branche hôte de `/dashboard/rooms` fait **une requête par bien** (N+1) | Inachevé | Moyenne | code |
| **B5** | Fiche publique : les avis sont plafonnés à **5** sans compteur ni « voir tous les avis », alors que `GET /api/reviews` est **déjà paginé** et que le compteur d'en-tête du bandeau existe (`totalReviews`) | Inachevé | Moyenne | runtime + code |
| **B6** | Des champs affichés que **personne ne peut remplir** : `description_en` (la fiche EN affiche donc le FR), `state` (adresse publique incomplète) et `latitude`/`longitude` (toute annonce créée depuis l'UI est **exclue** du filtre `near`) | Inachevé | Moyenne | base + code |
| **B7** | Quatre capacités de l'API sans entrée d'interface : `sort=popularity`, `minRating`, `near`, `search` (les trois premiers répondent 200 à l'exécution ; le formulaire `/recherche` ne les envoie jamais) | Mal pensé | Faible | runtime + code |
| **B8** | Suppression de compte : le **crédit BestRewards gelé** n'est ni signalé, ni journalisé, ni remboursé — il reste sur une ligne anonymisée invisible | Mal pensé | Moyenne | code |
| **B9** | Préférences de notification : **1 interrupteur** par utilisateur (alertes prix) contre **11 réglages globaux** admin — un voyageur ne peut pas réduire ses e-mails ; l'écran laisse croire l'inverse | Inachevé | Faible | code |
| **B10** | Dette T-207 assumée mais non récapitulée : `POST /api/bookings/[id]/payment` (410), `GET /api/providers/stripe` (stub), compat `propertyId`/`roomId`, page `/dashboard/rooms/[id]` qui ne fait que rediriger — **aucun n'est appelé par l'UI** | Hygiène | Faible | code |
| **B11** | **10 écrans lourds sans `loading.tsx`** (`/dashboard`, `/dashboard/properties`, `/bookings`, `/rooms`, `/messages`, `/properties/[id]`, `/promotions`, `/mon-compte`, `/mes-reservations`, `/hebergement/[slug]`) alors que 11 autres en ont un | Mal pensé (perception) | Faible | code |
| **B12** | Rate-limit **en mémoire** sur les routes d'authentification (login, inscription, mots de passe, réservations) : documenté comme temporaire ; en multi-instance, la limite est divisée par le nombre d'instances | Limitation connue | Faible | code |

Les 12 constats sont **des finitions ou des incohérences internes**, jamais des pannes : aucune page ne renvoie d'erreur, aucun bouton n'est mort, aucun texte n'est en dur (voir § 4).

## 3. Constats détaillés et solutions non régressives

### B1 — Supervision cron : la cadence déclarée contredit l'ordonnanceur

**Constat.** `src/lib/cron-trace.ts:28-30` déclare `"price-alerts": 60 * 60 * 1000` avec le commentaire « horaire (`vercel.json` : « 0 * * * * ») ». Or `vercel.json:5` planifie **`0 8 * * *`** (quotidien 08:00 UTC) — les deux entrées du fichier sont quotidiennes. La tolérance `STALE_FACTOR = 3` fait donc passer pour « en retard » toute exécution vieille de plus de 3 h.

**Preuve d'exécution.** Trace insérée à `now() − 4 h`, puis `GET /api/health` :

```
cronStatus = stale
status = stale | age = 240 min | attendu toutes les 60 min
```

Avec la cadence réellement configurée (24 h), une exécution de 4 h est **normale** : l'écran `/dashboard/cron` affichera « En retard » de 11:00 UTC jusqu'au passage de 08:00, soit ~21 h sur 24. Un moniteur branché sur `cronStatus` crie au loup chaque jour — et l'écran de supervision livré la veille perd sa crédibilité.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Aligner `CRON_SCHEDULES["price-alerts"]` sur la cadence réelle (24 h) et corriger le commentaire | La logique (tolérance 3×) et le contrat `getCronHealth` sont intacts ; `expectedEveryMinutes` passe de 60 à 1440 — seule la valeur d'affichage change |
| 2 | Dans `src/lib/cron-trace.test.ts:114-139`, déplacer le cas `stale` au-delà de 3 × 24 h et garder un cas `ok` à 23 h | Test uniquement |
| 3 | (option) Afficher la cadence attendue sur `/dashboard/cron` — 1 clé FR/EN (`cron.expectedEvery`) → verrou i18n 1739 + 1 | Additif |
| 4 | (option robuste) `scripts/check-cron-schedule.mjs` : compare `vercel.json` ↔ `CRON_SCHEDULES` en CI | Interdit définitivement la dérive ; aucune dépendance runtime |

### B2 — `/api/cron/payouts` : planifié, silencieux, en 410 quotidien

**Constat.** `vercel.json:9` planifie `/api/cron/payouts`. La route (`src/app/api/cron/payouts/route.ts:42-53`) répond **410 `PLATFORM_PAYOUTS_DISABLED`** *avant* toute écriture dès que `platformPayoutsEnabled()` est faux (défaut). `runWithTrace` n'est appelé que par `price-alerts` (`route.ts:26,304`) et `CRON_SCHEDULES` n'a pas d'entrée `payouts` : la tâche n'apparaît donc **ni** sur `/dashboard/cron`, **ni** dans `/api/health`.

**Impact.** Chaque jour, un cron en erreur (410) côté hébergeur sans aucun écho dans le produit ; et le jour où les versements sont activés — la tâche la plus sensible financièrement — elle serait la seule sans trace d'exécution. `scripts/cron-runner.mjs:48` boucle d'ailleurs déjà sur `["price-alerts", "payouts"]`.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Retirer l'entrée `payouts` de `vercel.json` **tant que** le drapeau est `off` + une ligne dans `KNOWN_LIMITATIONS.md` (« à ré-ajouter en même temps que l'activation des versements ») | La route reste servie (exécution manuelle, tests) ; rien de produit ne change : la tâche ne faisait que renvoyer 410 |
| 2 | Quand les versements seront activés : `runWithTrace("payouts", …)` + `CRON_SCHEDULES["payouts"]` + carte d'écran | Additif, calqué sur T-250 |
| 3 | (alternative, plus lourde) Statut `skipped` dans `cron_runs` | Exige une migration + un état d'écran : à ne faire que si l'ordonnancement doit rester visible en permanence |

### B3 — E-mails : trois stratégies de base URL, dont deux produisent des liens cassés

**Constat.** `lib/app-url.ts` (T-165) centralise la base publique avec repli absolu et warning unique ; il est utilisé par `mail/templates.ts`, `cron/price-alerts`, `properties/[id]/validate`, `users/[id]/two-factor/reset`, `unsubscribe`. Quatre familles de sites l'ignorent :

| Site | Valeur par défaut | Effet si la variable manque |
|---|---|---|
| `src/lib/booking-lifecycle-emails.ts:21` (`?? ""`) | chaîne vide | boutons **relatifs** (`/mes-reservations`, `/mes-reservations/avis/<id>`) dans les rappels J-3/J-1 et la demande d'avis |
| `src/app/api/messages/route.ts:232` (`?? ""`) | chaîne vide | bouton **relatif** (`/messages/<id>`, `/dashboard/messages/<id>`) dans l'e-mail « nouveau message » |
| `src/app/api/bookings/route.ts:569`, `auth/register:97`, `auth/forgot-password:48`, `auth/resend-verification:67`, `auth/logout:6` (`?? "http://localhost:3000"`) | localhost | liens **`http://localhost:3000/verifier-email?token=…`** : vérification de compte, réinitialisation, confirmation impossibles |
| `src/app/api/auth/verify/route.ts:18` (`request.nextUrl.origin`) | origine de la requête | acceptable pour une redirection, mais seul site de ce type |

**Preuve.** L'`email_outbox` locale (73 lignes) contient exclusivement des `href` absolus… parce que `NEXT_PUBLIC_APP_URL` est défini dans `.env.local` (`http://localhost:3000`). Le bug est donc **latent** : un déploiement sans variable envoie des liens inutilisables, et rien ne casse en local — c'est exactement le motif qu'un audit d'exécution doit remonter.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Router les 7 sites par `appBaseUrl()` (un import + une ligne chacun) | Comportement **identique** quand la variable est définie ; sinon lien absolu + warning déjà prévu |
| 2 | Vérifier `render.test.ts`, `templates.t236.test.ts` et les tests des routes auth qui pourraient asserter `http://localhost:3000` : conserver l'assertion si le test définit la variable, sinon la basculer sur `appBaseUrl()` | Tests |
| 3 | Test de garde : rendre 3 e-mails représentatifs (vérification, rappel, nouveau message) et asserter qu'**aucun `href` ne commence par `/`** | Interdit le retour du bug |
| 4 | Compléter la checklist de déploiement (`docs/CI.md`) : variable obligatoire, repli documenté | Doc |

### B4 — Deux écrans de liste encore hors fenêtre (et un N+1 côté hôte)

**Constat.** `src/lib/page-window.ts:54` (`parsePageWindow`) + `ShowMore` couvrent 7 écrans (`bookings`, `properties`, `users`, `reviews`, `promotions`, `mes-reservations`, `cron`). Deux écrans restent en chargement intégral :

- `src/app/dashboard/messages/page.tsx:41-51` : toutes les conversations (avec sous-requête `EXISTS` et compteurs non lus) sans limite ni « voir plus » ;
- `src/app/dashboard/rooms/page.tsx:20-27` (admin, requête jointe) et surtout `:40-52` : **une requête par bien** dans une boucle `for (const prop of hostProperties)` → N+1 puis rendu complet côté hôte.

**Impact.** Dernière incohérence de la livraison T-245/246 : deux écrans sur neuf échappent au contrat de fenêtre, avec un coût linéaire au nombre de biens/conversations.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Branche hôte de `/dashboard/rooms` : remplacer la boucle par **une** requête jointe `rooms ⋈ properties` filtrée par `host_id` (mêmes champs, même tri `createdAt desc`) | Refactor iso-résultat : la sortie est identique, seuls les allers-retours disparaissent |
| 2 | Appliquer `parsePageWindow` + `ShowMore` aux deux écrans (clés `show.*` déjà présentes) | Additif ; sans paramètre, la fenêtre par défaut s'applique comme sur les 7 autres écrans |
| 3 | Conserver la compatibilité des liens `?limit=` | `ShowMore` porte déjà le paramètre |

### B5 — Fiche publique : cinq avis pour toujours, sans le dire

**Constat.** `src/app/(main)/hebergement/[slug]/page.tsx:123` charge `reviews … limit(5)` et la section (`:532` « Avis vérifiés ✓ ») n'affiche **aucun compteur**, alors que :
- `property.totalReviews` existe et est affiché dans le bandeau haut (`card.reviewsCount`) ;
- la clé `property.reviews` (`src/lib/ui-strings.ts:343`) n'est utilisée **nulle part** ;
- `GET /api/reviews?propertyId=…&limit=…&offset=…` est **déjà paginé** — vérifié : `limit=3&offset=0` → 3 avis, `limit=3&offset=3` → 1 avis.

**Impact.** Sur un bien à 40 avis, la fiche en montre 5 à vie, sans indication qu'il en manque : perte de preuve sociale et incohérence avec le compteur du bandeau. Le seed (4 avis approuvés au maximum) ne le rend pas visible — d'où l'intérêt de la mesure dans la base.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Afficher le compte dans l'en-tête de la section (`Avis vérifiés (12)`) et préciser « les 5 plus récents » — 1 clé FR/EN | Additif, aucune requête supplémentaire |
| 2 | (recommandé) Page dédiée `/hebergement/[slug]/avis` paginée, consommant l'API publique existante + lien « Voir les 12 avis » depuis la fiche | Nouvelle route ; la fiche garde son `limit(5)` (même performance) ; réutilise `ReviewHelpfulButton` + `ShowMore` |
| 3 | Garder la clé `property.reviews` comme titre de la nouvelle page | Résorbe une clé orpheline (verrou inchangé) |

### B6 — Des champs affichés que personne ne peut remplir

**Constat.** Confrontation schéma ↔ API ↔ formulaires :

| Champ | Schéma | API | Formulaire | Écran |
|---|---|---|---|---|
| `descriptionEn` | `src/db/schema.ts:215` | **absent** des schémas create/update | absent | `LocalizedDescription` l'utilise… et retombe sur le FR |
| `state` | `:219` | accepté (`api/properties/route.ts:24`, `[id]/route.ts:26`) | absent (création `page.tsx:36-49` ; éditeur, onglets `:239-244`) | adresse publique (`lib/public-property.ts:69`) |
| `latitude` / `longitude` | `:222-223` | acceptés (`route.ts:29-30`) | absents | filtre `near` (`api/properties/route.ts:311-315`) qui **écarte** les biens sans coordonnées |

**Preuve base.** `description_en` : 0 / 8 renseignés. `state` : 0 / 8. Coordonnées : 8 / 8 — **parce que le seed les écrit**, pas l'interface : toute annonce créée par un hôte réel est donc invisible pour `near`.

**Solution non régressive (trois étapes indépendantes).**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | `descriptionEn: z.string().max(4000).optional()` dans les deux schémas + `Textarea` « Description (EN) » dans l'onglet Informations | Champ **optionnel** : aucune annonce existante ne change ; le repli FR est déjà en place et testé |
| 2 | `state` en texte libre (0–100) dans la création et l'éditeur | Affichage public déjà conditionnel |
| 3 | `latitude`/`longitude` optionnels dans l'éditeur avec validation d'intervalle (−90..90 / −180..180) | Tant que vide : comportement actuel inchangé (le bien reste hors `near`) ; pas de géocodage externe |
| 4 | 1 test de schéma par champ ; 2 à 4 clés FR/EN ; verrou i18n recalculé | Aucune migration (colonnes existantes) |

### B7 — Quatre capacités de l'API que l'interface n'expose pas

**Constat (runtime, base seed).** `GET /api/properties?sort=popularity&limit=3` → 200 (3 résultats) ; `?minRating=9.2` → 200 (4) ; `?near=48.86,2.35,50` → 200 (2) ; `?search=toscana` → 200 (1). Le formulaire `/recherche` (`(main)/recherche/page.tsx:415-419`) n'expose que `rating | price_asc | price_desc` et n'envoie jamais `minRating`, `near` ni `search`. Le bandeau d'avertissement (`search.warn.sortIgnored`, T-249) protège déjà les valeurs inconnues.

**Impact.** Deux fonctions réellement implémentées (note minimale, recherche autour de moi) sont inaccessibles ; `search` est une capacité orpheline ; `popularity` est traitée mais introuvable.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Option « Populaires » dans le `<select>` de tri | Valeur déjà gérée par l'API (`route.ts:212`) ; 1 clé FR/EN |
| 2 | Filtre « Note minimale » (0–10, pas de 0,5) | Paramètre déjà validé (0–10, 400 sinon) |
| 3 | Bouton « Autour de moi » : composant client `navigator.geolocation` → `near=lat,lng,25`, avec repli sur la saisie de ville si refus | Nouveau paramètre seulement ; le reste du formulaire reste un `GET` sans JS |
| 4 | Brancher `search` (nom de bien dans le champ destination) **ou** documenter son abandon | Décision produit ; sans effet sur les autres filtres |

### B8 — Suppression de compte : un crédit gelé qui disparaît en silence

**Constat.** `DELETE /api/users/me` anonymise le compte (`lib/account-anonymization.ts:61-97`) et **ne touche pas** `users.wallet_balance` (`schema.ts:36`) ni `wallet_transactions` ; la boîte de confirmation (`components/delete-account-section.tsx`, clés `account.deleteBody` FR/EN) ne mentionne pas l'avoir. Le solde reste donc attaché à une ligne anonymisée (`deleted-…@anonymized.local`) : ni visible, ni utilisable, ni remboursé.

**Impact.** C'est le seul scénario où le gel T-248 §3 produit un effet **défavorable** à l'utilisateur : BestRewards annonce un « crédit accumulé » et sa suppression de compte l'efface sans mot.

**Solution (strictement conforme au gel : aucune consommation de solde).**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Dans la zone de danger, si `walletBalance > 0` : encart « Votre crédit accumulé de X sera perdu » (1 clé FR/EN + montant formaté) | Additif et conditionnel |
| 2 | Écrire **dans la transaction** de suppression une ligne `wallet_transactions` de traçabilité (`kind: "account_closed"`, montant 0, `balanceAfter` = solde) **sans modifier le solde** | `kind` est un `varchar(32)` → **aucune migration** ; journal append-only conservé |
| 3 | (option, décision produit) Refuser la suppression tant que le solde est > 0 | À éviter sans arbitrage : bloquerait un droit RGPD |
| 4 | Verrou : `src/lib/wallet-policy.test.ts` doit continuer à passer (aucune déduction, aucune mutation du solde) | Test existant |

### B9 — Préférences de notification : un interrupteur par utilisateur, onze globaux

**Constat.** `components/notification-prefs-section.tsx:12-18` n'expose que `priceAlertEnabled` et documente elle-même l'absence de table par utilisateur. Les 11 autres interrupteurs sont globaux (admin) : vérification exhaustive → les 12 clés `settings.notify.*` sont bien **lues** dans le code d'envoi, seul `newsletter` est non branché, grisé et expliqué (« ce réglage n'a aucun effet »).

**Impact.** Un voyageur ne peut pas réduire les rappels de séjour ou les demandes d'avis ; l'écran « Préférences » suggère un contrôle qui n'existe pas au-delà des alertes prix.

**Solution (lot optionnel, plus lourd).**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Colonne `users.notification_prefs` `jsonb` (migration additive, `null` = héritage du réglage global) | Tant qu'elle est `null`, les envois lisent le global : **comportement actuel exact** |
| 2 | Helper pur `enabledFor(user, key)` appelé par les 12 points d'envoi | Test unitaire ; contrats d'envoi inchangés |
| 3 | Étendre l'écran de préférences à 3–4 catégories (rappels, demandes d'avis, décisions de modération) ; les e-mails transactionnels critiques (confirmation, vérification, sécurité) restent non désactivables | i18n +, décision produit sur la liste |
| 4 | (immédiat, peu coûteux) Compléter la phrase d'aide de l'écran : les autres e-mails sont réglés globalement par l'équipe — 1 clé FR/EN | Additif |

### B10 — Résidus de la sortie du paiement en ligne : à récapituler, pas à supprimer

**Constat.** Vérifié : **aucun** de ces éléments n'est appelé par l'interface.

| Élément | État | Remarque |
|---|---|---|
| `POST /api/bookings/[id]/payment` | 410 explicite (`route.ts:14,27`) | conservé pour les liens anciens — cohérent avec T-207 |
| `GET /api/providers/stripe` | `{ configured: false, onlinePaymentDisabled: true }` | stub intentionnel, ne divulgue aucun secret ✓ |
| Compat `propertyId`/`roomId` (`(main)/reservation/reservation-form.tsx:95-98`) | lecture temporaire documentée | à retirer quand plus aucun lien legacy ne circule |
| `/dashboard/rooms/[id]` | redirection serveur vers `/calendrier` | aucun lien interne ne la cible ; conservée pour les favoris |
| `bookings.paymentMethodOffline` / `paymentIntentId` / `paymentExpiresAt` | écrits et lus (marquage « réglé hors plateforme », expiration T-203) | **ne pas nettoyer** : le tunnel manuel en dépend |

**Solution.** Une entrée `KNOWN_LIMITATIONS.md` « dette T-207 » listant ces résidus avec leur condition de retrait, et un commentaire `// legacy:` sur les deux sites de compat. Aucune suppression de route : les vieux liens continuent d'être servis (410 explicite plutôt qu'une page morte).

### B11 — Dix écrans lourds sans squelette de chargement

**Constat.** 11 pages ont un `loading.tsx` (`aide`, `bestrewards`, `mes-favoris`, `recherche`, `reservation`, `analytics`, `audit`, `billing`, `reviews`, `settings`, `users`). N'en ont pas : `/dashboard` (4 requêtes parallèles), `/dashboard/properties`, `/dashboard/bookings`, `/dashboard/rooms`, `/dashboard/messages`, `/dashboard/properties/[id]`, `/dashboard/promotions`, `/mon-compte`, `/mes-reservations`, `/hebergement/[slug]`.

**Impact.** Mesuré à 84–300 ms en local (donc invisible ici) ; avec une base distante ou un démarrage à froid, la navigation reste figée sans retour visuel : c'est aujourd'hui la seule différence de perception entre les deux moitiés de l'application.

**Solution.** Copier les squelettes existants (`components/ui/*skeleton*`) dans les 10 dossiers : **purement additif**, aucune page modifiée, aucun test à adapter.

### B12 — Rate-limit en mémoire : limitation connue, à énoncer au déploiement

**Constat.** `lib/rate-limit.ts` (Map + fenêtre glissante) protège connexion (20/min/IP + 10/min/e-mail), inscription, changement de mot de passe, mot de passe oublié, renvoi de vérification, réinitialisation et le tunnel de réservation (quotas invité). Le fichier documente lui-même le remplacement par Redis en multi-instance. `api/reviews/[id]/helpful` réserve le 429 au spam et renvoie 409 pour un vote déjà posé (T-126) ✓.

**Impact.** Sur plusieurs instances, la limite effective est divisée par le nombre d'instances : protection affaiblie, jamais de blocage légitime.

**Solution.** Aucun changement de code : ligne « rate-limit en mémoire → Redis si > 1 instance » dans la checklist de mise en production, et, si souhaité, un avertissement **unique** au démarrage quand `NODE_ENV=production` et `REDIS_URL` est absent (log, aucun impact runtime).

## 4. Vérifications saines (hypothèses infirmées — à ne pas rouvrir)

| Hypothèse | Résultat |
|---|---|
| Des pages exploseraient à l'exécution | **Faux** : 45 pages balayées (anonyme, voyageur, admin) → 100 % en 200/307 attendus, **0 « Application error »**. Hors 200 : redirections d'auth (307) et `/wishlists/share/abc` (404 volontaire). `/maintenance` redirige vers `/` quand la maintenance est inactive (comportement voulu) |
| Boutons sans action | **Aucun** : 1 seul `<button>` sans handler = bouton de réservation volontairement désactivé (`components/property-booking-card.tsx:151`) ; les 13 `<Button>` sans `onClick` sont dans un `<Link>` ou de `type="submit"` ; 2 `div onClick` (voiles de fermeture des menus) sans `role` — point accessibilité mineur, non bloquant |
| i18n : textes en dur | **Aucun** : nœuds JSX hors `t()` → 3 occurrences, toutes dans des commentaires ou un test ; le centre d'aide est bilingue par construction (T-158) |
| Routes API sans contrôle d'accès | **Aucune anomalie** : 12 routes sans garde = auth publique (rate-limitée), `/api/health`, `/api/maintenance-status`, `/api/app-preferences`, `/api/promotions/apply`, partage de liste par jeton, stub Stripe sans secret. Facture : propriétaire **ou** hôte **ou** admin, sinon 403 |
| Interrupteurs de notification morts | **Aucun** : 12/12 lus par le code d'envoi ; `newsletter` non branché, grisé, expliqué |
| Le cron annulerait les demandes manuelles (bug T-202) | **Toujours corrigé** : `expirePendingBookings` ne traite que les réservations portant un `paymentIntentId` (`api/cron/price-alerts/route.ts:153-158`) |
| Le contrat bulk masquerait les échecs admin | **Sain** : `{ requested, succeeded, skipped[], failed[] }` avec un motif par élément (vérifié dans la route et utilisé par les 5 managers) |
| L'interface atteindrait les 410 du paiement en ligne | **Faux** : aucun `fetch` vers `/payment` ni `/providers/stripe` ; le tunnel se termine par « aucun paiement en ligne n'est demandé par la plateforme » (`reservation.manualRequestBody`) |
| Les e-mails de demande manuelle omettraient le règlement | **Sain** : la phrase « aucun paiement n'est demandé sur MyBestBooking » figure dans le gabarit anglais et le repli d'expiration exclut les règlements hors plateforme (`paymentMethodOffline`) |
| Alertes prix à double interrupteur (global + utilisateur) | **Sain et observable** : T-223 documente le ET logique et le cron expose `priceAlertsEnabled` dans ses compteurs |
| Rétention/purge technique | **Déjà livrées** (T-250 pour `cron_runs` 90 j, T-243 pour sessions/outbox) ; `cron_runs` = 0 après la passe |

## 5. Décisions à trancher (réponse oui / non)

| Lot | Constats | Nature | Risque | Effort |
|---|---|---|---|---|
| **A** | B1, B2, B3, B11 | Corrections d'exécution sûres : supervision juste, e-mails fiables, squelettes | **Très faible** (B3 touche des e-mails) | ~1 session |
| **B** | B4, B5, B6 | Finir ce qui est à moitié câblé : fenêtres de liste, avis paginés, champs éditables | Faible | 1–2 sessions |
| **C** | B7, B9 | Aller au bout des capacités : filtres de recherche exposés, préférences par utilisateur | Faible (B7) / moyen (B9) | 1–2 sessions |
| **D** | B8, B10, B12 | Hygiène produit et dette : crédit à la suppression, résidus T-207, rate-limit documenté | Faible | ~0,5 session |

Ordre recommandé si plusieurs lots sont retenus : **A** (dont B3, qui concerne des e-mails réellement envoyés) → **D** (B8 : l'argent avant le reste) → **B** → **C**. Chaque lot reste livrable seul, avec tests, i18n FR/EN et CI verte ; aucun lot ne modifie de contrat existant (API opt-in, états de réservation, journal du wallet).

## 6. État de la base après la passe

| Contrôle | Valeur finale |
|---|---|
| `users` / `properties` / `bookings` / `reviews` | 8 / 8 / 30 / 21 (identique au seed) |
| `cron_runs` | 0 (la ligne de test datée de −4 h a été supprimée) |
| `wallet_transactions` / `price_alerts` / `wishlist_items` | 0 / 0 / 0 |
| `email_outbox` | 73 (inchangé, aucune écriture) |
| Code | **aucune modification** : analyse uniquement (SELECT + sondes HTTP GET) |
| Serveur de développement | relancé après la fin du précédent (`:3000`, accessible) |
