# Audit fonctionnel profond n°33 — T-210 — Scénarios runtime après T-209

- **Date** : 2026-09-10
- **Branche** : `arena/01a08747-mybestbooking`
- **Type** : audit runtime complémentaire + correction UI localisée
- **Auteur** : Agent Arena.ai
- **Demande utilisateur** : analyser profondément les pages, boutons et fonctionnalités à l'exécution ; repérer ce qui est inachevé ou mal pensé ; pour chaque problème expliquer le problème et proposer une solution sans régression ; implémenter explicitement le retrait des dates d'arrivée/départ et du nombre de voyageurs du filtre de la page d'accueil.

## 1. Méthode

L'audit T-210 a combiné inspection du code réel et preuves runtime :

- 🔍 inspection de `src/app/page.tsx`, `/recherche`, fiche hébergement, tunnel réservation et actions de réservation ;
- 🧪 test ciblé du contrat du formulaire d'accueil ;
- 🧪 suite Vitest globale ;
- 🔨 typecheck, lint, i18n et build production ;
- ▶️ smoke HTTP complet ;
- ▶️ simulations surface/deep/xtreme/paranoid via `scripts/run_all_sims.py` ;
- ▶️ crawl `site:audit` multi-profils sur serveur production ;
- ▶️ probe HTTP ciblé comparant les champs du formulaire `/` et `/recherche`.

Commandes principales exécutées :

```bash
npm run test -- src/app/page.home-filter.test.ts
npm run test -- src/app/api/cron/price-alerts/route.test.ts
npm run test
npm run typecheck
npm run lint
python3 -m py_compile scripts/xtreme_sim.py scripts/run_all_sims.py
npm run i18n:check
npm run build
npm run smoke
python3 scripts/run_all_sims.py
node scripts/reset_test_db.mjs
npm run site:audit -- http://127.0.0.1:3000   # sur next start
```

Probe ciblé final :

```text
/          {'city': True, 'checkIn': False, 'checkOut': False, 'guests': False} action=/recherche True
/recherche {'city': True, 'checkIn': True,  'checkOut': True,  'guests': True } action=/recherche True
```

## 2. Ce qui fonctionne bien et doit être préservé

- `/recherche` conserve un formulaire avancé complet : destination, dates, voyageurs, type, pays, équipements, tri et prix.
- La fiche `/hebergement/[slug]` conserve les dates/adultes/enfants dans la carte de réservation ; ces champs servent à la disponibilité réelle et au lien vers `/reservation`.
- `/reservation` conserve les dates, la chambre, les voyageurs, le devis serveur, les coordonnées et la demande manuelle sans paiement plateforme.
- Les CTA de réservation restent orientés "demande" / "voir disponibilité", pas "payer maintenant".
- Les actions hôte/admin restent disponibles côté dashboard : confirmer une demande, constater un règlement hors plateforme, annuler, clôturer selon les règles serveur.
- Les gardes T-207 restent en place : pas de formulaire carte, pas de Stripe public dans le tunnel, `/api/bookings/[id]/payment` désactivée, wallet informatif.
- Les simulations longues terminent sans KO ni WARN après réalignement du faux signal `reportSilentFetchIssue`.

## 3. Findings et solutions sans régression

### F1 — Corrigé T-210 — Le formulaire d'accueil demandait dates et voyageurs trop tôt

**Constat**

Le hero de `src/app/page.tsx` contenait `name="checkIn"`, `name="checkOut"` et `name="guests"` alors que l'accueil doit servir d'entrée rapide.

**Problème**

Cette conception mélangeait deux moments du parcours :

1. l'accueil, qui doit déclencher la découverte avec une intention simple ;
2. la recherche/fiche, où dates et voyageurs ont une valeur fonctionnelle forte pour calculer disponibilité, capacité et prix.

Sur l'accueil, ces champs ajoutaient de la friction, donnaient l'impression qu'il fallait connaître tout son séjour avant d'explorer, et dupliquaient le formulaire avancé de `/recherche`.

**Solution implémentée sans régression**

- `src/app/page.tsx` : suppression locale des deux inputs date et du select voyageurs.
- Le formulaire conserve `action="/recherche"` et `name="city"`.
- `/recherche`, `PropertyBookingCard` et `/reservation` ne sont pas supprimés ni simplifiés : dates/voyageurs restent disponibles aux étapes où ils sont nécessaires.
- `src/app/page.home-filter.test.ts` verrouille l'absence des anciens champs sur l'accueil et la présence du couple destination → `/recherche`.

**Preuves**

- 🧪 `npm run test -- src/app/page.home-filter.test.ts` : 2/2.
- ▶️ probe HTTP final : `/` a `city` seul ; `/recherche` garde `city/checkIn/checkOut/guests`.
- ▶️ smoke 95/95 et `site:audit` 247 pages / 0 issue.

---

### F2 — Corrigé T-210 (QA) — La simulation xtreme ne reconnaissait pas l'observabilité discrète des fetchs silencieux

**Constat**

Les logs historiques signalaient encore les composants `maintenance-gate` et `unread-messages-badge` comme lacunes UX potentielles, alors que T-209 avait ajouté `reportSilentFetchIssue` pour tracer discrètement les fetchs volontairement fail-open.

**Problème**

Le harnais QA était désynchronisé du contrat produit : ces composants ne doivent pas bloquer l'utilisateur ni afficher un état bruyant. Les classer comme absence de feedback produit crée du bruit et peut pousser à ajouter une UI inutile.

**Solution implémentée sans régression**

- `scripts/xtreme_sim.py` reconnaît maintenant `reportSilentFetchIssue` comme feedback discret valide.
- Aucun composant produit n'a été changé : le comportement fail-open reste identique.

**Preuves**

- 🔨 `python3 -m py_compile scripts/xtreme_sim.py scripts/run_all_sims.py` : OK.
- ▶️ `python3 scripts/run_all_sims.py` : 402 assertions cumulées, 0 WARN, 0 KO.

---

### F3 — À traiter si souhaité — `site:audit` est fiable en production mais fragile sur serveur dev long crawl

**Constat**

Deux exécutions de `npm run site:audit -- http://127.0.0.1:3000` sur serveur `next dev` ont terminé avec des `EXC fetch failed` en fin de crawl. Les logs serveur montraient de nombreux HTTP 200 avant une sortie propre de `next dev`, sans stacktrace applicative. Le même crawl exécuté sur `next start` après `npm run build` a visité 247 pages avec 0 issue.

**Problème**

Le défaut observé n'est pas une page cassée du produit mais une fragilité de validation quand le crawl multi-profils sature ou termine un serveur dev Turbopack. Cela peut produire de faux rouges dans les audits et faire perdre du temps.

**Solution sans régression proposée**

- Documenter/privilégier `npm run build` + `next start` pour `site:audit` de clôture.
- Option future : ajouter un wrapper `npm run site:audit:prod` qui démarre `next start`, attend `/api/health`, exécute le crawl puis stoppe le serveur.
- Garder `site:audit` actuel pour auditer une instance déjà servie ; ne pas changer le crawler en profondeur sans besoin.

**État T-210**

Pas de correctif produit requis. La validation finale utilise le serveur production et passe.

---

### F4 — Résiduel produit connu — Carte géographique visuelle encore partielle

**Constat**

`FEATURES.md` indique que le filtre géographique `near=lat,lng,km` existe côté API, mais qu'aucun rendu carte Mapbox/Leaflet n'est livré.

**Problème**

Pour une plateforme de réservation, l'absence de carte limite la découverte spatiale : l'utilisateur peut filtrer par ville/pays, mais ne visualise pas immédiatement les quartiers et distances.

**Solution sans régression proposée**

- Ajouter une carte progressive sur `/recherche` en complément de la liste, pas en remplacement.
- Conserver le formulaire et les résultats actuels comme source principale.
- Charger la carte côté client, de façon optionnelle, avec fallback liste si la librairie ou la clé fournisseur est absente.
- Réutiliser les coordonnées existantes et ne jamais bloquer la recherche si la carte échoue.

---

### F5 — Résiduel validation externe — Providers réels non validés dans le sandbox

**Constat**

Les intégrations externes Stripe/Resend/S3-R2 restent limitées par l'absence de comptes et credentials réels dans ce sandbox. Ce point est déjà documenté comme limite explicite.

**Problème**

Les tests prouvent les contrats internes, les garde-fous et les chemins mock/console, mais pas la livraison email réelle, le stockage objet réel ni les intégrations Stripe externes. Après T-207/T-209, ce n'est pas bloquant pour le parcours voyageur sans paiement plateforme, mais cela reste important avant production.

**Solution sans régression proposée**

- Prévoir un environnement staging avec credentials réels isolés.
- Exécuter une matrice de tests manuels/automatisés : email livré, upload privé/public, webhook signé, désactivation paiement voyageur toujours respectée.
- Ne pas réactiver les paiements plateforme pour valider ces providers : les tests doivent vérifier explicitement que les routes voyageur restent sans paiement.

---

### F6 — Résiduel validation navigateur — Les preuves HTTP ne remplacent pas un E2E navigateur complet

**Constat**

T-210 a validé via Vitest, smoke HTTP, simulations curl/DB et crawl HTML. Les interactions JS critiques sont fortement couvertes par ces harnais, mais un vrai navigateur Playwright reste plus représentatif pour les détails de focus, clics, hydration et responsive.

**Problème**

Certains défauts purement navigateur peuvent passer sous les preuves HTTP : focus, erreurs d'hydration non fatales, comportement mobile, double clics, état de bouton pendant réseau lent.

**Solution sans régression proposée**

- Ajouter/relancer Playwright en CI lorsque Chromium est disponible dans l'environnement.
- Cibler en priorité : accueil → recherche, recherche → fiche, fiche → demande, hôte confirme/refuse, messagerie, dashboard mobile.
- Garder les tests HTTP actuels comme garde rapide ; l'E2E navigateur complète mais ne remplace pas Vitest/smoke.

## 4. Décision produit T-210

- Le seul défaut applicatif nouveau et directement demandé est corrigé : l'accueil ne demande plus dates/voyageurs.
- Aucun nouveau défaut bloquant P1/P2 n'a été détecté après T-209 dans les parcours pages/boutons/API exercés.
- Les résiduels F3→F6 sont des sujets de robustesse QA, UX avancée ou validation externe ; ils sont proposés sans interrompre le périmètre T-210.

## 5. Non-régression vérifiée

- `/` : destination + CTA vers `/recherche`, sans `checkIn/checkOut/guests`.
- `/recherche` : filtres avancés conservés.
- Fiche hébergement : dates/voyageurs conservés pour disponibilité.
- `/reservation` : demande sans paiement plateforme, devis informatif, emails/TTL T-209 préservés.
- Dashboard hôte/admin : actions manuelles conservées.
- Paiement plateforme voyageur : toujours absent.

## 6. Preuves synthétiques

| Preuve | Résultat |
|---|---|
| Test ciblé accueil | 2/2 |
| Test TTL cron isolé | 1/1 |
| Vitest global | 100 fichiers passés / 2 skipped ; 577 tests passés / 17 skipped |
| TypeScript | 0 erreur |
| ESLint | 0 erreur |
| i18n | 0 écart |
| Build production | 65 pages générées |
| Smoke HTTP | 95/95 |
| Simulations unifiées | 402 OK / 0 WARN / 0 KO |
| Site audit production | 247 pages / 0 issue |
| Probe `/` vs `/recherche` | contrat T-210 confirmé |
