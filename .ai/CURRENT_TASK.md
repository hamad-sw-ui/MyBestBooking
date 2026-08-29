# 🎯 TÂCHE EN COURS

**Tâche :** Ajout d'un bouton explicite « Importer depuis l'ordinateur » pour
les photos de propriété (demande utilisateur), avec remplacement direct d'une
image existante.

**Constat.** Le sélecteur de fichiers de la machine s'ouvrait déjà via un
`<input type="file">` natif, mais : (1) il avait l'apparence d'un champ générique
et non d'un bouton ; (2) dans la galerie d'édition on ne pouvait que
*supprimer* ou *définir principale* — impossible de **remplacer** une photo
(supprimer + ré-ajouter cassait l'ordre et le statut « principale »).

**Solution (additive, aucune migration/route).**
- 🔨 `src/components/photo-upload-button.tsx` (nouveau) : `<Button>` stylé qui
  déclenche un `<input type="file">` masqué (`ref.click()`), props `onFile`,
  `accept`, `multiple`, `loading`, `variant/size`, `title`, `ariaLabel` ; reset
  de la valeur pour re-sélectionner le même fichier.
- 🔨 Page création : bouton « Importer depuis l'ordinateur » + bouton
  « Changer l'image » sous l'aperçu.
- 🔨 Page édition : bouton « Importer » en tête d'onglet + action
  « Changer cette image » sur chaque vignette ; helper
  `uploadPhoto(file, replaceUrl?)` qui remplace l'URL en place (ordre conservé,
  statut « principale » suit la nouvelle URL) ou ajoute en galerie.
- Réutilise tel quel `POST /api/properties/upload` (multipart, 5 Mo, magic-bytes,
  réservé hôte/admin).

**ID** : T-141 — additif.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-141)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288 passés (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **59 pages**) ·
  `ai:check` **19 OK · 1 warn · 0 fail** (warn R7 = synchro HEAD, résolu au commit).
- ▶️ DEV : upload hôte PNG → 200 `{url:/uploads/…}` ; client → 403 ; pages
  new/edit 200. PROD (`next start` 3100, arrêté) : bouton « Importer » présent
  dans le HTML (libellé + aria-label).
- 🧹 PNG de test supprimé de `public/uploads/`, résa smoke supprimée →
  **32 réservations**.
- Rapport : `.ai/REPORTS/validation_T-141_2026-08-29.md`.
