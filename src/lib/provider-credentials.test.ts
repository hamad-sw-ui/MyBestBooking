import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { __providerCredentialsTesting } from "./provider-credentials";

describe("provider credentials crypto", () => {
  it("chiffre puis déchiffre avec AES-GCM", () => {
    const key = randomBytes(32);
    const sealed = __providerCredentialsTesting.encrypt("sk_test_secret_value", key);
    expect(sealed.ciphertext).not.toContain("sk_test_secret_value");
    expect(__providerCredentialsTesting.decrypt(sealed, key)).toBe("sk_test_secret_value");
  });

  it("refuse un ciphertext authentifié modifié", () => {
    const key = randomBytes(32);
    const sealed = __providerCredentialsTesting.encrypt("secret", key);
    expect(() => __providerCredentialsTesting.decrypt({ ...sealed, authTag: "AAAAAAAAAAAAAAAAAAAAAA==" }, key)).toThrow(/déchiffrer/);
  });
});
