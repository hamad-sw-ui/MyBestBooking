import { describe, it, expect } from "vitest";
import {
  BACKUP_CODE_COUNT,
  consumeBackupCode,
  generateBackupCodes,
  hashBackupCodes,
  normalizeBackupCode,
  remainingBackupCodes,
  type StoredBackupCode,
} from "./backup-codes";

/**
 * T-231 (audit n°2, A11) — codes de secours 2FA.
 *
 * Le point critique de l'audit : la 2FA n'offrait aucune porte de sortie en cas
 * de perte du téléphone. Ces tests vérifient que l'échappatoire existe **sans
 * affaiblir** le facteur : codes à usage unique, stockés hachés, jamais en
 * clair, et un code consommé ne redevient pas utilisable.
 */

describe("T-231 — codes de secours 2FA", () => {
  it("génère 10 codes distincts, lisibles et non ambigus", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(BACKUP_CODE_COUNT);
    expect(new Set(codes).size).toBe(BACKUP_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
      // Alphabet sans 0/O/1/I/L : pas de confusion à la recopie manuelle.
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });

  it("ne stocke JAMAIS le code en clair (empreintes bcrypt seulement)", async () => {
    const codes = generateBackupCodes(3);
    const stored = await hashBackupCodes(codes);
    expect(stored).toHaveLength(3);
    const serialized = JSON.stringify(stored);
    for (const code of codes) {
      expect(serialized).not.toContain(code);
      expect(serialized).not.toContain(normalizeBackupCode(code));
    }
    for (const entry of stored) {
      expect(entry.hash).toMatch(/^\$2[aby]\$/);
      expect(entry.usedAt).toBeNull();
    }
  });

  it("consomme un code une seule fois (usage unique réel)", async () => {
    const [plain] = generateBackupCodes(1);
    const stored = await hashBackupCodes([plain]);

    const first = await consumeBackupCode(stored, plain);
    expect(first.outcome).toBe("consumed");
    expect(remainingBackupCodes(first.next)).toBe(0);
    expect(first.next[0].usedAt).not.toBeNull();

    // Deuxième tentative avec le même code → refus explicite.
    const second = await consumeBackupCode(first.next, plain);
    expect(second.outcome).toBe("already_used");
    expect(remainingBackupCodes(second.next)).toBe(0);
  });

  it("accepte une saisie tolérante (casse, espaces, tirets manquants)", async () => {
    const [plain] = generateBackupCodes(1);
    const stored = await hashBackupCodes([plain]);
    const messy = ` ${plain.toLowerCase().replace("-", " ")} `;
    const { outcome } = await consumeBackupCode(stored, messy);
    expect(outcome).toBe("consumed");
  });

  it("refuse un code inconnu, tronqué, absent ou malformé", async () => {
    const stored = await hashBackupCodes(generateBackupCodes(2));
    const other = generateBackupCodes(1)[0];
    expect((await consumeBackupCode(stored, other)).outcome).toBe("invalid");
    expect((await consumeBackupCode(stored, "ABCDE")).outcome).toBe("invalid");
    expect((await consumeBackupCode(stored, "")).outcome).toBe("invalid");
    expect((await consumeBackupCode(null, "ABCDE-FGHIJ")).outcome).toBe("invalid");
    expect((await consumeBackupCode(stored, "!!!!!-!!!!!")).outcome).toBe("invalid");
    // Aucun code n'a été consommé par ces tentatives.
    expect(remainingBackupCodes(stored)).toBe(2);
  });

  it("ne consomme que le code présenté quand plusieurs existent", async () => {
    const codes = generateBackupCodes(4);
    const stored = await hashBackupCodes(codes);
    const { outcome, next } = await consumeBackupCode(stored, codes[2]);
    expect(outcome).toBe("consumed");
    expect(remainingBackupCodes(next)).toBe(3);
    expect(next[2].usedAt).not.toBeNull();
    expect(next[0].usedAt).toBeNull();
    // Les autres codes restent valides.
    expect((await consumeBackupCode(next, codes[0])).outcome).toBe("consumed");
  });

  it("remainingBackupCodes compte les codes utilisables uniquement", () => {
    const list: StoredBackupCode[] = [
      { hash: "x", usedAt: null },
      { hash: "y", usedAt: new Date().toISOString() },
    ];
    expect(remainingBackupCodes(list)).toBe(1);
    expect(remainingBackupCodes([])).toBe(0);
    expect(remainingBackupCodes(null)).toBe(0);
  });
});
