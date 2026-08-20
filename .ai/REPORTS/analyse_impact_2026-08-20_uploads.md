# Impact — T-014 : Upload d'images

- **Date** : 2026-08-20 · **Niveau** : **S** · **Ref** : §14

## Quoi
Nouveau endpoint `POST /api/uploads` qui accepte `multipart/form-data`
(champ `file`), valide MIME (image/jpeg, image/png, image/webp) et
taille (≤ 5 MB), stocke via un adapter et retourne l'URL publique.

2 adaptateurs :
- **`LocalUploader`** (dev, sandbox) : écrit dans `public/uploads/`,
  URL relative `/uploads/<hash>.jpg`.
- **`S3Uploader`** (prod) : signé S3-compat (R2/S3/DigitalOcean),
  actif si `S3_ENDPOINT`+`S3_BUCKET`+`S3_ACCESS_KEY`+`S3_SECRET_KEY`
  définis.

## Où
- `src/lib/storage/{types,local,s3,index}.ts` + tests
- `src/app/api/uploads/route.ts`
- `src/components/ui/image-uploader.tsx` (composant client)
- `.env.example` documente les 4 variables S3

## Pourquoi
Débloque PAR-010 (publication d'annonce complète avec photos), et
côté produit tout formulaire (property, room, avatar) qui aujourd'hui
demande une URL image saisie à la main.

## Contrat public
- POST /api/uploads : authentifié, multipart, retourne
  `{ url, size, mimeType }`.
- 400 si MIME invalide, 413 si trop gros, 401 si non authentifié.

## Sécurité
- Auth requise (`getCurrentUser`).
- MIME whitelisté + extension canonique dérivée.
- Nom de fichier randomisé (`crypto.randomUUID()`).
- Rate-limit 20 uploads/h par user.
- Aucun path traversal possible (nom généré server-side).
