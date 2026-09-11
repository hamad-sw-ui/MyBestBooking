-- T-250 (audit n°5, A7) — migration additive : trace d'exécution des crons.
--
-- Le cron `/api/cron/price-alerts` renvoyait ses compteurs dans la réponse
-- HTTP, mais rien ne les conservait : un ordonnanceur muet (URL modifiée,
-- CRON_SECRET absent, conteneur arrêté) passait totalement inaperçu. Une ligne
-- par exécution, succès comme échec, purgée à 90 jours par
-- `purgeTechnicalData()`.
--
-- Aucune table existante n'est modifiée ; la table est créée seulement si elle
-- n'existe pas (déploiement idempotent).
CREATE TABLE IF NOT EXISTS "cron_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(64) NOT NULL,
  "started_at" timestamp NOT NULL,
  "finished_at" timestamp,
  "ok" boolean DEFAULT false NOT NULL,
  "duration_ms" integer,
  "counters" jsonb,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cron_runs_name_started" ON "cron_runs" ("name", "started_at");
