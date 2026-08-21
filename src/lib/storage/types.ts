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

  /**
   * Supprime un fichier par son key (T-026).
   * Retourne true si supprimé, false si absent ou erreur non fatale.
   * Ne throw jamais (best-effort).
   */
  remove(key: string): Promise<boolean>;
}
