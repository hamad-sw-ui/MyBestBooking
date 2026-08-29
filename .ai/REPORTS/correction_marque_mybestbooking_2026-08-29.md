# Cohérence de marque — « mybestbooking » → « MyBestBooking » — 2026-08-29

Demande : s'assurer que le M et le B de « mybestbooking » sont en majuscule,
c.-à-d. afficher la marque en CamelCase **MyBestBooking** (comme le nom du
dépôt), partout où elle apparaît comme nom de marque visible.

🔨 **Corrigé (texte visible + métadonnées, 5 logos + textes fr/en) :**
- Logos bicolores (garde la séparation de couleurs et le ✦) : `header.tsx`,
  `footer.tsx`, `dashboard-sidebar.tsx`, `dashboard-mobile-header.tsx`,
  `(auth)/layout.tsx` → `MyBest` (bleu/blanc) + `Booking` (corail).
- Textes : accueil connexion/inscription, BestRewards (3), « Informations
  MyBestBooking » (fiche), « Wallet MyBestBooking », accueil dashboard,
  `ui-strings.ts` (footer ©, sous-titre réservations, « Pourquoi choisir
  MyBestBooking ? » en fr **et** en).
- Métadonnées `app/layout.tsx` : `title.default`, `title.template`,
  `openGraph.siteName`, `openGraph.title`, `twitter.title` → MyBestBooking.
- Copyright `(auth)/layout.tsx` → « © 2025 MyBestBooking ».
- Nom de fichier d'export CSV facturation → `MyBestBooking-revenus.csv`.

✅ **Préservé volontairement (technique, doit rester en minuscules) :**
- Adresses e-mail `support@/partners@/privacy@/admin@/host@/customer@mybestbooking.com`.
- Domaine/expéditeur `no-reply@mybestbooking.example`, libellés mail
  `…@mybestbooking.com`, chemins (`/home/user/MyBestBooking`), noms de tables.
- `manifest.json` et `settings.siteName` étaient déjà « MyBestBooking ».

▶️ **Validation :** `tsc` 0 · `eslint` 0 · `vitest` 276 passés / 12 ignorés
(tests DB) / 0 échec · `smoke` **94/94** · `build` ✓ (60 pages) · `ai:check`
19 OK / 1 warn. Titre HTML rendu : `<title>MyBestBooking — Réservez mieux.
Voyagez plus.</title>`. Réservation de test smoke nettoyée (37 réservations).
