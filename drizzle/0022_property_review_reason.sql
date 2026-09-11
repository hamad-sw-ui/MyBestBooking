-- T-237 (audit n°3, F6) — migration additive.
--
-- 1) Motif de rejet/suspension d'annonce : il n'existait que dans `audit_log`,
--    donc invisible pour l'hôte, qui voyait son annonce repasser en `draft`
--    sans explication. La colonne porte le dernier motif communiqué ; elle est
--    remise à NULL à l'approbation (le motif ne doit pas survivre à une mise en
--    ligne).
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "review_reason" varchar(500);
