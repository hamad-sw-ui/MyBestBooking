import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T-186 — Visuels de démonstration **locaux** (`public/seed-images/`).
 *
 * ## Pourquoi
 * Historiquement le seed référençait des URLs Unsplash distantes. Soucis :
 * 1. le sandbox/preview n'a **pas d'egress Internet** vers Unsplash →
 *    l'optimizer `/_next/image` (qui récupère côté serveur) casserait ;
 * 2. dépendance réseau inutile pour une démo (latence, lien mort possible).
 *
 * ## Contrat
 * `seedImageUrl(key, legacyUrl)` renvoie le chemin `/seed-images/<fichier>`
 * **si et seulement si** le fichier existe réellement dans `public/` ;
 * sinon l'URL distante historique (comportement inchangé tant qu'un visuel
 * n'a pas été généré — rollout progressif sans 404).
 *
 * Les clés sont stables : elles nomment les fichiers versionnés
 * `public/seed-images/<clé>.jpg` (générés en T-186 — bascule automatique
 * dès qu'un fichier apparaît).
 *
 * Alias documentés (copies locales volontaires, fidélité historique) :
 * - `dest-tunis.jpg` = `dar-el-medina-1.jpg` (médina de Tunis : la même
 *   photo Unsplash servait historiquement la fiche ET la destination) ;
 * - `hero-home.jpg` = `dar-el-medina-1.jpg` (idem pour le fond du hero) ;
 * - `placeholder-property.jpg` = `villa-azure-1.jpg` (placeholder
 *   d'attente — pourra être remplacé par un visuel dédié neutre).
 *
 * Le chemin servi est PUBLIC (statique Next) ; avec l'optimizer activé
 * (T-186 étape 2) ces mêmes chemins passeront par `/_next/image` en
 * local, sans egress.
 */

const SEED_DIR = resolve(process.cwd(), "public", "seed-images");

/** Registry : clé logique → nom de fichier local attendu. */
export const SEED_IMAGE_KEYS = [
  "hotel-le-magnifique-1",
  "hotel-le-magnifique-2",
  "riad-jardin-secret-1",
  "riad-jardin-secret-2",
  "villa-azure-1",
  "villa-azure-2",
  "appartement-montmartre-1",
  "appartement-montmartre-2",
  "dar-el-medina-1",
  "dar-el-medina-2",
  "resort-les-dunes-1",
  "resort-les-dunes-2",
  "hotel-barcelona-center-1",
  "hotel-barcelona-center-2",
  "bb-toscana-1",
  "bb-toscana-2",
  "dest-paris",
  "dest-marrakech",
  "dest-barcelone",
  "dest-rome",
  "dest-tunis",
  "hero-home",
  "placeholder-property",
] as const;

export type SeedImageKey = (typeof SEED_IMAGE_KEYS)[number];

/**
 * Résout l'URL d'image du seed : locale si présente, distante sinon.
 * `legacyUrl` est le comportement historique (jamais de 404 provoqué).
 */
export function seedImageUrl(key: SeedImageKey, legacyUrl: string): string {
  const localPath = `/seed-images/${key}.jpg`;
  // existsSync côté serveur uniquement (route API Node — jamais client).
  if (existsSync(resolve(SEED_DIR, `${key}.jpg`))) return localPath;
  return legacyUrl;
}
