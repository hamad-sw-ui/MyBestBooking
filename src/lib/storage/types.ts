export interface StoredFile {
  // Les nouveaux uploads de messagerie sont privés : url peut être null.
  url: string | null;
  key: string;
  size: number;
  mimeType: string;
}

export interface RetrievedFile {
  body: Buffer;
  mimeType: string | null;
}

/**
 * Fichier PUBLIC (ex : photo d'annonce). `url` est toujours renseignée et
 * accessible sans authentification (statique `/uploads/...` en dev, CDN
 * S3/R2 en production).
 */
export interface PublicStoredFile {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface PublicUploader {
  /** Sauvegarde une image publique et renvoie son URL servable. */
  put(file: Buffer, mimeType: string, ownerId: string): Promise<PublicStoredFile>;
  remove(key: string): Promise<boolean>;
}

export interface Uploader {
  /**
   * Sauvegarde un fichier binaire et renvoie son URL publique.
   * `ownerId` sert à préfixer / tracer l'appartenance (pas exposé
   * intégralement dans le nom de fichier).
   */
  put(file: Buffer, mimeType: string, ownerId: string): Promise<StoredFile>;

  /**
   * Supprime un fichier par son key (T-026).
   * Retourne true si supprimé, false si absent ou erreur non fatale.
   * Ne throw jamais (best-effort).
   */
  remove(key: string): Promise<boolean>;

  /** Lit un fichier privé après que le handler applicatif a vérifié l'accès. */
  get(key: string): Promise<RetrievedFile | null>;
}
