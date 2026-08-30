-- T-125 (P2) : bouclage du programme de parrainage.
-- Migration additive et sûre : deux colonnes nullable sur users, aucune
-- donnée existante modifiée. La récompense est versée une seule fois,
-- garantie par `referral_rewarded_at` (idempotence du cron de complétion).
--  - referred_by : parrain de l'utilisateur (code saisi à l'inscription),
--    auto-référence ; SET NULL si le parrain vient à être supprimé.
--  - referral_rewarded_at : horodatage de la récompense déjà versée pour
--    ce filleul (NULL = pas encore versée).
ALTER TABLE "users" ADD COLUMN "referred_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_rewarded_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_users_id_fk" FOREIGN KEY ("referred_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;