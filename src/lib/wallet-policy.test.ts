import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { uiStrings } from "@/lib/ui-strings";

/**
 * T-248 §3 (audit n°5, A6 — décision produit) — **le wallet est gelé**.
 *
 * Décision retenue : le solde BestRewards reste un **crédit futur** tracé
 * (journal + historique livrés par T-248 §1-2) et **n'est pas dépensable**. On
 * assume le gel au lieu de promettre un avantage impossible à utiliser.
 *
 * Ce test est le garde-fou de la décision : il vérifie que les libellés qui
 * parlent du solde disent le gel, et qu'aucun chemin de code ne déduit le solde
 * dans un tunnel de réservation. Réintroduire une déduction exige donc de
 * changer explicitement ces libellés **et** ce test — la décision produit est
 * documentée dans `.ai/KNOWN_LIMITATIONS.md` et `.ai/BACKLOG.md` (T-248).
 */

const FR = uiStrings("fr");
const EN = uiStrings("en");

const FROZEN_KEYS = [
  "account.walletHint",
  "search.walletBanner",
  "reservation.walletReductionNote",
  "bestrewards.faq4A",
] as const;

describe("T-248 §3 — le wallet est un crédit futur (gel assumé)", () => {
  it("les libellés FR annoncent le gel, jamais une déduction", () => {
    for (const key of FROZEN_KEYS) {
      const text = FR[key];
      expect(text, key).toMatch(/crédit futur|gelé/i);
    }
    expect(FR["account.availableBalance"]).toMatch(/crédit futur/i);
    expect(FR["bestrewards.benefitCashback"]).toMatch(/crédit futur/i);
  });

  it("les libellés EN disent la même chose (parité de décision)", () => {
    for (const key of FROZEN_KEYS) {
      const text = EN[key];
      expect(text, key).toMatch(/future credit|frozen/i);
    }
    expect(EN["account.availableBalance"]).toMatch(/future credit/i);
    expect(EN["bestrewards.benefitCashback"]).toMatch(/future credit/i);
  });

  it("aucun chemin de code ne déduit le solde du wallet", () => {
    // 1) Le helper de déduction supprimé par T-252 n'est pas revenu.
    const bookingRoute = readFileSync(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
    expect(bookingRoute).toMatch(/walletUsedEur\s*=\s*0/);
    expect(bookingRoute).not.toMatch(/applyWalletToTotal/);

    // 2) Aucune route ne calcule de réduction depuis le solde.
    const health = readFileSync(new URL("../app/api/wallet/transactions/route.ts", import.meta.url), "utf8");
    expect(health).not.toMatch(/method:\s*"(POST|PATCH|PUT|DELETE)"|export async function (POST|PATCH|PUT|DELETE)/);
  });
});
