-- T-230 / T-231 (audit n°2, A10 + A11) — migration additive.
--
-- 1) Distinction suspension / suppression : `deleted_at` servait aux deux.
--    Migration des suspensions EXISTANTES : un compte suspendu a `deleted_at`
--    renseigné SANS avoir été anonymisé (l'anonymisation remplace l'e-mail par
--    `deleted-<hash>@anonymized.local`). Ces comptes redeviennent « suspendus »
--    et restent réactivables ; les comptes anonymisés conservent `deleted_at`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_reason" varchar(500);
UPDATE "users"
   SET "suspended_at" = "deleted_at",
       "deleted_at" = NULL
 WHERE "deleted_at" IS NOT NULL
   AND "email" NOT LIKE 'deleted-%@anonymized.local';

-- 2) Codes de secours 2FA (hachés bcrypt, usage unique) — jsonb additif.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" jsonb;
