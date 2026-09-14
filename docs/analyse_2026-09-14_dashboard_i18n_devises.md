# Audit des dashboards — traduction et devises

- **Date** : 2026-09-14
- **Branche** : `arena/01a0a06b-mybestbooking`
- **Commit audité** : `2ab61b6` (`feat(i18n/currency): complete FR/EN audit + display-currency conversion`)
- **Périmètre** : espace hôte/admin (`/dashboard/*`), navigation desktop/mobile, pages publiques et compte qui alimentent les préférences d'affichage.
- **Note de lecture** : les sections 1 à 4 conservent le constat et le plan de l'audit initial ; l'état après implémentation et la seconde vérification sont consignés en section 5.

## Verdict exécutif

**Non : la traduction et la conversion ne sont pas encore complètes et homogènes à 100 % sur toutes les interfaces.**

La situation est toutefois meilleure qu'une absence d'i18n :

- la traduction **FR/EN des libellés UI** est largement présente et bien structurée ;
- les totaux principaux de l'accueil, de la facturation et des analytics ont déjà une conversion indicative ;
- la devise de réservation, de paiement, de remboursement et les montants comptables restent volontairement dans la devise native de la chambre/réservation — ce principe est sain et doit être conservé ;
- plusieurs écrans secondaires, agrégats, exports et parcours de changement de préférence ne suivent pas encore la même règle.

Le niveau actuel est donc : **i18n des libellés : partiellement complète et globalement fonctionnelle ; devise d'affichage : fonctionnelle sur certains totaux, incomplète et parfois incorrecte sur les agrégats secondaires.** Il ne faut pas annoncer « 100 % » avant le plan ci-dessous et sa validation runtime.

## 1. Ce qui fonctionne

### 1.1 Traduction

- `src/lib/ui-strings.ts` contient **1 787 clés FR et 1 787 clés EN**, sans clé manquante d'un dictionnaire à l'autre.
- `UiStringKey`, `makeT()` et `useT()` donnent un contrôle TypeScript sur les clés utilisées.
- `src/app/layout.tsx` installe le `UiLocaleProvider` global et `getServerLocale()` résout le compte, le header/cookie puis le réglage plateforme.
- Les pages serveur du dashboard et les composants client bulk/admin utilisent majoritairement `makeT()`/`useT()` : accueil, propriétés, chambres, réservations, avis, messages, promotions, analytics, billing, utilisateurs, audit, cron et paramètres.
- Les deux variantes de navigation du dashboard existent et exposent les sélecteurs FR/EN et de devise : `dashboard-sidebar.tsx` et `dashboard-mobile-header.tsx`.
- Le fallback arabe est explicite : il retombe en français tant qu'aucun dictionnaire arabe/RTL n'existe. C'est préférable à un choix `ar` qui afficherait une interface faussement traduite.

### 1.2 Conversion

- Les taux et le formatage sont centralisés dans `src/lib/i18n.ts` (`convertAmount`, `formatMoney`, devises zéro-décimales).
- `sumByCurrency()` évite correctement de sommer nativement des EUR, USD, XAF, etc.
- `formatCurrencyConverted()` donne une lecture unifiée indicative pour les cartes de total de l'accueil, `billing` et `analytics`.
- La réservation conserve sa devise de chambre (`booking.currency`) pour le montant réel, ce qui protège contre la conversion d'un montant qui doit être payé, remboursé ou audité.
- Le wallet BestRewards est stocké en EUR et est converti à l'affichage sur le compte, dans BestRewards, dans l'historique et à la suppression du compte, avec un principe explicite de crédit futur.

## 2. Écarts constatés

### 2.1 Traduction / locale

| ID | Constat | Impact | Priorité |
|---|---|---|---|
| I18N-01 | Le changement de langue via `ProfileForm` enregistre bien le profil puis fait seulement `router.refresh()` (`src/components/profile-form.tsx:101-123`). Il ne déclenche pas `invalidateDisplayPreferences()` ; le cache client peut donc conserver l'ancienne langue jusqu'à une navigation complète/F5. | Interface momentanément mixte après une action pourtant réussie. | P1 |
| I18N-02 | `DashboardSidebar` et `DashboardMobileHeader` déclarent `initialLanguage` mais ne le transmettent pas à `LanguageSelector` (`dashboard-sidebar.tsx:32-38`, `dashboard-mobile-header.tsx:20-25`). Le provider traduit les labels SSR, mais la valeur initiale du sélecteur peut apparaître `FR` avant la résolution client d'un compte EN. | UX incohérente et flash de préférence. | P1 |
| I18N-03 | `/dashboard/cron` utilise `Date.toLocaleString(undefined, ...)` (`cron/page.tsx:66,155`) au lieu de la locale UI résolue. Le format dépend alors du runtime navigateur/serveur, pas du choix FR/EN. | Une partie du dashboard n'est pas déterministe en EN. | P1 |
| I18N-04 | `scripts/check-i18n.mjs` est toujours WARN-only et remonte six lignes, dont des commentaires, ainsi que le défaut `closeLabel = "Fermer"` de `ui/dialog.tsx`. Le scan est heuristique et ne prouve pas l'absence de textes dynamiques non traduits. | Faux sentiment de couverture à « 0 erreur ». | P1 |
| I18N-05 | Les valeurs métier saisies en base (nom d'hébergement, nom de chambre, noms de listes, commentaires, motifs) ne sont pas des libellés traduisibles. Les descriptions publiques ont un fallback `descriptionEn`, mais la plupart des noms restent volontairement dans la langue saisie. | À documenter comme règle produit ; ne pas traduire automatiquement une donnée utilisateur sans décision. | P2 |
| I18N-06 | Plusieurs fallbacks affichent encore un code brut si une valeur métier inconnue arrive (`status`, type, pays, action d'audit). C'est défensif, mais pas une garantie de libellé FR/EN. | Une nouvelle valeur backend peut ressortir en anglais technique ou en snake_case. | P2 |

### 2.2 Conversion de devise

| ID | Constat | Impact | Priorité |
|---|---|---|---|
| FX-01 | L'accueil convertit la carte « Revenus », mais son tableau des réservations récentes affiche le montant natif (`dashboard/page.tsx:197-199` puis `:297-298`). | Deux représentations différentes sur le même écran. | P1 |
| FX-02 | `BookingsManager` additionne `booking.total` sans regroupement (`bulk/bookings-manager.tsx:200-205`) puis force l'affichage du résultat en EUR (`:229-234`). Avec des devises mixtes, le chiffre est économiquement faux. | Erreur financière visible dans `/dashboard/bookings`. | P0 |
| FX-03 | Analytics convertit les cartes KPI, mais le graphique reste dans `analytics.chartCurrency`, et son titre/tooltip utilisent la devise native (`analytics/page.tsx:181-200`). Les « top properties » utilisent également `formatCurrencyBreakdown()` natif (`:231`). | Le choix de devise de l'utilisateur ne s'applique pas à toute la page. | P1 |
| FX-04 | Billing convertit les trois cartes de synthèse, mais les versements/factures et transactions récentes restent natifs (`billing/page.tsx:279`, `:328-330`). Ce serait acceptable si la devise native était toujours explicitement présentée comme référence ; ce n'est pas homogène avec les cartes converties. | Risque de comparer un total converti à des lignes natives sans explication suffisante. | P1 |
| FX-05 | Les chambres et calendriers du dashboard affichent le prix dans la devise de la chambre (`rooms-manager`, `rooms/*/calendrier`, `rate-plans-section`). C'est correct pour la valeur source, mais incomplet si « devise d'affichage » signifie que tous les aperçus doivent proposer aussi la conversion indicative. | Fonctionnalité perçue comme partielle. | P1 |
| FX-06 | Les sélecteurs ne sont pas alignés : profil et taux supportent EUR/USD/GBP/CHF/MAD/XAF ; sélecteur public, dashboard et réglages admin n'exposent que EUR/USD/GBP/XAF. Un compte en CHF ou MAD peut donc avoir une valeur courante absente des options du dashboard. | Sélecteur impossible à utiliser correctement pour toutes les valeurs persistées. | P1 |
| FX-07 | `/recherche` utilise le montant `EUR` en dur pour le bandeau wallet (`recherche/page.tsx:403`). Le compte et BestRewards convertissent ce même solde dans la devise d'affichage. | Même wallet montré avec deux unités selon l'écran. | P1 |
| FX-08 | Après sauvegarde de la devise dans `ProfileForm`, le cache de `useDisplayPreferences()` n'est pas invalidé (`profile-form.tsx:121-123`). La valeur en base est correcte, mais les composants déjà montés peuvent conserver l'ancienne devise. | Changement de devise non immédiatement fiable. | P0 |
| FX-09 | Les taux de `RATES_FROM_EUR` sont figés dans le code. Ils sont acceptables pour une conversion indicative V1, pas pour annoncer une conversion actuelle ou un montant financier exact. Aucune date/source de taux n'est présentée. | Résultat potentiellement obsolète. | P1 / décision produit |
| FX-10 | `formatCurrencyConverted()` ignore silencieusement une devise inconnue ; des données legacy peuvent donc disparaître d'un total (`currency-summary.ts`). | Sous-total incomplet sans alerte. | P0 |
| FX-11 | `topCurrency()` choisit la plus grande valeur nominale, sans la ramener dans une base commune. 1 000 XAF peut donc dominer 100 EUR selon la valeur numérique et piloter le graphique/comparatif. | Mauvaise devise dominante et analyse trompeuse. | P1 |
| FX-12 | Les exports analytics/billing restent natifs par devise. C'est défendable pour l'audit, mais ils ne contiennent pas encore une paire explicite `native amount / display amount / rate / as-of` pour reproduire la vue convertie. | Export non équivalent à l'écran. | P2 |

> **Règle à préserver** : aucune conversion silencieuse dans le paiement, le remboursement, le wallet ledger, le reçu ou le montant légal. Pour ces surfaces, afficher au besoin une deuxième valeur indicative, mais garder la valeur native, la devise native et la trace de l'opération.

## 3. Preuves exécutées

| Vérification | Résultat |
|---|---|
| `npm run typecheck` | **OK** |
| `npm run lint` | **OK**, aucun warning remonté |
| `npm run i18n:check` | **exit 0**, mais **6 candidats WARN** ; ce n'est pas un zéro candidat réel |
| Tests ciblés i18n/devise (5 fichiers) | **55/55 OK** |
| Suite Vitest complète sans PostgreSQL | **611 OK, 5 échecs, 275 skipped** ; les échecs concernés dépendent de PostgreSQL absent (`127.0.0.1:55432`) et ne permettent pas une certification complète |
| `npm run build` avec secrets factices mais sans PostgreSQL | Compilation et TypeScript OK ; échec de génération de `/sitemap.xml` sur connexion DB absente |
| Runtime dashboard / E2E | Non certifiable dans ce sandbox : PostgreSQL embarqué échoue faute de `libpq.so.5` |

Les tests ciblés démontrent les fonctions de conversion et la symétrie FR/EN ; ils ne démontrent pas le rendu de chaque route avec un compte hôte/admin dans un navigateur réel.

## 4. Plan correctif non régressif vers 100 %

### Phase 0 — verrouiller le contrat produit avant de modifier le code

1. Décider si la plateforme expose **4 devises** (EUR/USD/GBP/XAF) ou **6** (ajout CHF/MAD). Une seule source de vérité doit alimenter réglages admin, API, profil, sélecteur public, sélecteur dashboard et validation DB.
2. Définir explicitement les catégories :
   - **montant natif/auditable** : devise de la chambre/réservation, jamais converti pour une écriture financière ;
   - **montant d'affichage** : conversion indicative vers la préférence du compte ;
   - **taux** : source, date d'effet, précision et arrondi.
3. Pour chaque écran, choisir entre « natif seul avec badge source » ou « converti principal + natif secondaire ». Ne jamais mélanger les deux sans libellé.

### Phase 1 — corriger le cycle de préférence et la locale

1. Passer `initialLanguage` du layout dashboard aux deux `LanguageSelector` et initialiser la valeur du select avec `user.language`/locale SSR.
2. Après un PATCH réussi depuis `ProfileForm`, appeler `invalidateDisplayPreferences()` puis `router.refresh()` ; en cas de changement de langue, recharger ou appliquer la même stratégie de synchronisation que `LanguageSelector`.
3. Remplacer les deux `toLocaleString(undefined, ...)` du cron par le helper date central avec `locale` (`fr-FR`/`en-GB`) et couvrir les états `never`, `stale`, `failed`, `missing` en FR/EN.
4. Rendre le contrôle i18n plus fiable : extraction AST des textes JSX/attributs, détection des `t()` dynamiques non typés, test des valeurs de fallback, puis passer `--strict` une fois les candidats traités.
5. Traduire les erreurs serveur via des codes stables (`errorCode`) et un mapping UI, sans afficher directement un texte backend non localisé.

**Garde-fous** : tests de composant sur compte FR et EN, changement depuis profil et sélecteur dashboard, test SSR sans flash, snapshot des pages desktop/mobile, test strict i18n.

### Phase 2 — unifier la devise d'affichage

1. Remplacer les listes locales par une constante/endpoint de devises supportées, avec conservation d'une valeur persistée valide même si elle n'est plus proposée.
2. Invalider les préférences après toute modification de profil, sélecteur dashboard et sélecteur public.
3. Corriger le parcours recherche : le changement de devise doit préserver/mettre à jour `displayCurrency` dans l'URL et recalculer les bornes ; pas seulement recharger un résultat SSR basé sur une URL sans la devise.
4. Convertir le wallet du bandeau recherche comme sur le compte, ou afficher explicitement « solde EUR » partout. Écrire des tests de cohérence entre `/recherche`, `/mon-compte` et `/bestrewards`.
5. Pour les taux figés, afficher au minimum « conversion indicative — taux du [date] ». Pour une conversion fiable en production, créer un adaptateur FX avec cache, source, timestamp, timeout, fallback connu et monitoring ; aucune transaction ne doit dépendre d'un taux indisponible.
6. Refuser/alerter les devises inconnues à l'entrée et lors de l'agrégation ; ne plus les ignorer silencieusement. Prévoir une migration/rapport pour les lignes legacy.

**Garde-fous** : six/ quatre devises selon la décision Phase 0, casse/arrondi, XAF zéro-décimale, taux indisponible, données legacy inconnues, persistance après reload et reconnexion.

### Phase 3 — couvrir toutes les surfaces dashboard

1. Créer un helper ou composant unique d'affichage (`DashboardMoney`) recevant `amount`, `sourceCurrency`, `displayCurrency`, `locale` et le contexte `native/indicative`.
2. Accueil : harmoniser carte de revenu et tableau des réservations récentes.
3. Réservations : remplacer le KPI EUR de `BookingsManager` par une agrégation par devise puis, si choisi en Phase 0, un total converti étiqueté ; afficher chaque ligne avec montant natif et conversion secondaire.
4. Analytics : produire le graphique et le classement dans la devise cible, ou afficher une série par devise ; classer après conversion dans une base commune ; conserver un bandeau listant les devises sources.
5. Billing : ajouter le montant converti dans les lignes tout en conservant le montant natif du payout/reçu comme référence légale/opérationnelle.
6. Chambres, calendrier, rate plans, propriétés et prévisualisations : afficher prix natif + conversion indicative cohérente, sans modifier la devise enregistrée lors d'un edit.
7. Exports : conserver les colonnes natives actuelles pour non-régression et ajouter, de façon additive, devise cible, montant converti, taux et date de taux. Une exportation doit être reconstructible et explicitement non fiscale si elle n'est pas une facture.

**Garde-fous** : fixtures avec EUR + USD + XAF + CHF/MAD, aucun total natif mélangé, égalité entre carte et détail, montant de paiement inchangé, CSV historique inchangé, tests de rôle host/admin et viewport mobile/desktop.

### Phase 4 — certification runtime et prévention des régressions

1. Fournir PostgreSQL dans CI/sandbox, appliquer toutes les migrations et charger des fixtures multi-devises avec un hôte et un admin.
2. Exécuter une matrice E2E : FR/EN × host/admin × desktop/mobile × chaque route dashboard, puis changer langue/devise et refaire une navigation complète.
3. Vérifier les invariants :
   - aucune clé FR absente en EN ;
   - aucun texte de contrôle non localisé ;
   - aucun montant réel changé par une préférence d'affichage ;
   - toute somme multi-devise est soit séparée, soit convertie avec taux affiché ;
   - aucune devise inconnue supprimée silencieusement ;
   - les URLs, filtres, exports et emails conservent leur contrat.
4. Pipeline de sortie bloquante : `typecheck`, `lint`, `i18n:check --strict`, tests unitaires, intégration DB, build avec DB, smoke HTTP et Playwright. Publier le rapport des 2 rôles et des 2 langues comme preuve de release.

## Critères d'acceptation finale

La fonctionnalité pourra être déclarée complète uniquement quand, pour chaque route et chaque rôle :

- le libellé FR/EN, le statut, l'erreur, le filtre, la date et le nombre sont localisés ;
- le sélecteur conserve sa valeur, y compris après modification depuis le profil, la navigation, le reload et la session suivante ;
- les montants natifs restent exacts et identifiables ;
- les montants d'affichage sont convertis partout où la préférence est promise, avec taux/date et précision cohérents ;
- aucun total de devises différentes n'est additionné sans conversion explicite ;
- les tests runtime passent avec des données réellement multi-devises.

Tant que ces critères ne sont pas réunis, la réponse correcte est **« partiellement fonctionnel, plan correctif requis »**, et non « conversion complète à 100 % ».

## 5. Ré-audit post-correctif — 2026-09-14

Une seconde lecture du code et une nouvelle validation ont été réalisées après
l'implémentation du plan. Les points suivants ont été contrôlés explicitement :

- le catalogue unique contient bien `EUR`, `USD`, `GBP`, `CHF`, `MAD` et `XAF` ;
- les montants de réservation, paiement, remboursement, wallet, reçu et payout
  restent dans leur devise native ;
- les agrégats multi-devises sont groupés par devise avant toute conversion ;
- les taux sont indicatifs et datés par `FX_SNAPSHOT.asOf` ;
- les devises inconnues restent visibles dans un breakdown natif et ne
  produisent pas de taux CSV ;
- `indicativeRate` normalise désormais les codes en casse minuscule/majuscule ;
- l'export analytics convertit chaque ligne native séparément, au lieu de
  répéter le total multi-devises de l'hébergement sur chaque ligne ;
- une devise utilisateur valide mais désactivée par la plateforme reste
  conservée afin qu'une sauvegarde de profil non liée à la devise ne soit pas
  bloquée ;
- le sélecteur dashboard retombe sur `XAF`, comme le défaut plateforme, avant
  résolution asynchrone ;
- les alertes de prix ne relabellisent plus une chambre legacy inconnue dans la
  devise cible après un fallback de conversion ;
- les surfaces chambres, calendrier et plans tarifaires du dashboard appliquent
  maintenant la même conversion indicative, tout en conservant les prix
  natifs utilisés par les champs d'édition et les écritures en base.

Une troisième vérification runtime a aussi changé temporairement la préférence
hôte en `MAD`, puis l'a restaurée à `XAF` : `/dashboard/rooms` et le calendrier
ont répondu `200` et le calendrier affichait bien la note « conversion
indicative en MAD … source en EUR ».

### Résultats de validation de la seconde passe

| Vérification | Résultat |
|---|---|
| Suite Vitest avec PostgreSQL seedé | **163 fichiers passés, 2 ignorés ; 871 tests passés, 28 ignorés** |
| Tests ciblés devise, agrégats, préférences, proxy | **56/56 OK** |
| Tests ciblés alertes de prix après garde legacy | **49/49 OK** |
| `npm run typecheck` | **OK** |
| `npm run lint` | **OK** |
| `npm run i18n:check -- --strict` | **OK — aucun candidat détecté** |
| `npm run build` avec PostgreSQL | **OK** |
| Smoke HTTP runtime | **OK** — santé DB, préférences, recherche EN/MAD, connexion hôte, dashboard et trois exports CSV en 200 |

La seule validation non exécutable dans ce sandbox reste le navigateur
Playwright : le binaire Chromium manque et son téléchargement échoue au niveau
réseau (`ECONNRESET`). Les tests E2E sont présents ; le comportement a été
complété par le smoke HTTP runtime, sans présenter cette limitation comme un
succès Playwright.
