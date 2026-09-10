import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

/**
 * T-231 (audit n°2, A11) — codes de secours 2FA.
 *
 * Constat : la seule façon de désactiver la 2FA était « mot de passe + code
 * TOTP ». Un utilisateur qui perd son téléphone ne pouvait plus se connecter
 * **ni** désactiver le facteur, et aucun reset support n'existait (le seul
 * « reset » disponible anonymisait le compte).
 *
 * Ici : 10 codes à usage unique, **stockés hachés** (bcrypt) et consommés une
 * seule fois. Aucun code en clair n'est persisté : la liste n'est affichée
 * qu'une fois, au moment où elle est générée.
 */

/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10; // 2 groupes de 5
const BCRYPT_ROUNDS = 10;
export const BACKUP_CODE_COUNT = 10;

export interface StoredBackupCode {
  /** Empreinte bcrypt du code (jamais le code lui-même). */
  hash: string;
  /** Horodatage ISO de consommation, `null` tant que le code est utilisable. */
  usedAt: string | null;
}

function randomChar(): string {
  return ALPHABET[randomInt(ALPHABET.length)];
}

/** Un code au format `XXXXX-XXXXX` (lisible par un humain, copiable). */
export function generateBackupCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    if (i === 5) out += "-";
    out += randomChar();
  }
  return out;
}

export function generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateBackupCode());
  return [...codes];
}

/** Normalise la saisie utilisateur (casse, espaces, tirets). */
export function normalizeBackupCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Hache une liste de codes pour stockage. */
export async function hashBackupCodes(codes: string[]): Promise<StoredBackupCode[]> {
  const stored: StoredBackupCode[] = [];
  for (const code of codes) {
    stored.push({ hash: await bcrypt.hash(normalizeBackupCode(code), BCRYPT_ROUNDS), usedAt: null });
  }
  return stored;
}

export type BackupCodeOutcome = "consumed" | "invalid" | "already_used";

/**
 * Vérifie un code et le consomme (usage unique). Retourne la liste mise à jour
 * à persister — l'appelant décide de la transaction.
 */
export async function consumeBackupCode(
  stored: StoredBackupCode[] | null | undefined,
  input: string,
): Promise<{ outcome: BackupCodeOutcome; next: StoredBackupCode[] }> {
  const list = Array.isArray(stored) ? stored : [];
  const candidate = normalizeBackupCode(input);
  if (candidate.length !== CODE_LENGTH) return { outcome: "invalid", next: list };

  let sawUsed = false;
  for (const entry of list) {
    if (entry?.usedAt) {
      // Un code déjà consommé ne doit pas redevenir valide ; on le signale
      // explicitement plutôt que de renvoyer « invalide » (support plus clair).
      if (await bcrypt.compare(candidate, entry.hash)) sawUsed = true;
      continue;
    }
    if (await bcrypt.compare(candidate, entry.hash)) {
      const next = list.map((item) =>
        item === entry ? { ...item, usedAt: new Date().toISOString() } : item,
      );
      return { outcome: "consumed", next };
    }
  }
  return { outcome: sawUsed ? "already_used" : "invalid", next: list };
}

/** Codes encore utilisables (UI : afficher le reste). */
export function remainingBackupCodes(stored: StoredBackupCode[] | null | undefined): number {
  if (!Array.isArray(stored)) return 0;
  return stored.filter((entry) => !entry?.usedAt).length;
}
