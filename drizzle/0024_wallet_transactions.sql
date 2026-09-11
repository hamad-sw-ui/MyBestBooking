-- T-248 (audit n°5, A6 — reprise de O1) — migration additive : journal du wallet.
--
-- `users.wallet_balance` restait une colonne scalaire mutée par 4 familles de
-- code (cashback BestRewards, bonus de parrainage, remboursements de
-- `booking-benefits` et de `booking-request-expiration`) sans aucune trace.
-- Ce journal permet d'expliquer un solde, de détecter un doublon de crédit et
-- d'auditer le programme.
--
-- Additif uniquement : aucune colonne existante n'est modifiée et
-- `users.wallet_balance` reste la source de vérité. `amount` est signé
-- (crédit > 0, débit < 0) et libellé EUR, comme le solde.
CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" numeric(10, 2) NOT NULL,
  "balance_after" numeric(10, 2) NOT NULL,
  "kind" varchar(32) NOT NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "actor_id" uuid,
  "note" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallet_transactions_user_created" ON "wallet_transactions" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_wallet_transactions_kind_created" ON "wallet_transactions" ("kind", "created_at");
