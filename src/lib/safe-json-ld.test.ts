import { describe, expect, it } from "vitest";
import { safeJsonForScript } from "./safe-json-ld";

describe("safeJsonForScript", () => {
  it("empêche une donnée hôte de fermer le script JSON-LD", () => {
    const output = safeJsonForScript({ description: "</script><script>alert(1)</script>" });
    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(output)).toEqual({ description: "</script><script>alert(1)</script>" });
  });
});
