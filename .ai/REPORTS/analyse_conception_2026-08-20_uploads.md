# Conception — T-014

## Options

**A. LocalUploader + S3Uploader (retenu)** : adaptable, dev sans
credentials, prod via S3/R2. Comme T-013 mail.

**B. UploadThing/Vercel Blob uniquement** : simplifie mais crée un
lock-in fournisseur. Rejeté.

**C. Base64 direct en DB** : ballonnera la DB. Rejeté.

## Format

```ts
interface Uploader {
  put(file: Buffer, mimeType: string, ownerId: string): Promise<{
    url: string; key: string; size: number;
  }>;
}
```

## Local

- Répertoire `public/uploads/` (servi par Next static).
- Nom : `<userId-prefix-8>-<uuid>.<ext>` — préserve indice
  d'appartenance sans exposer le userId complet.

## S3

- SDK **pas** utilisé (250 kB) — signature v4 manuelle via `crypto`.
  Compatible R2, S3, DigitalOcean Spaces, MinIO.
- URL retournée : `https://{S3_ENDPOINT}/{S3_BUCKET}/{key}` (public
  read) OU URL présignée si `S3_PRIVATE=true`.

## Rate-limit
- 20/h par userId dans src/lib/rate-limit.
