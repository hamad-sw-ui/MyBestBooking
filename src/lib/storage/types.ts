export interface StoredFile {
  url: string;    // URL publique ou présignée
  key: string;    // chemin/identifiant interne
  size: number;
}

export interface Uploader {
  /**
   * Sauvegarde un fichier binaire et renvoie son URL publique.
   * `ownerId` sert à préfixer / tracer l'appartenance (pas exposé
   * intégralement dans le nom de fichier).
   */
  put(file: Buffer, mimeType: string, ownerId: string): Promise<StoredFile>;
}
