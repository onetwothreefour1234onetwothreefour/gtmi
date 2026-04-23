CREATE TABLE IF NOT EXISTS "countries" (
	"iso_code" varchar(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"imd_rank" integer,
	"imd_appeal_score" numeric(5, 2),
	"imd_appeal_score_cme_normalized" numeric(5, 2),
	"gov_portal_url" text,
	"tax_authority_url" text,
	"last_imd_refresh" timestamp
);
--> statement-breakpoint
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"label" text NOT NULL,
	"data_type" varchar(50) NOT NULL,
	"pillar" varchar(1) NOT NULL,
	"sub_factor" varchar(10) NOT NULL,
	"weight_within_sub_factor" numeric(5, 4) NOT NULL,
	"extraction_prompt_md" text NOT NULL,
	"scoring_rubric_jsonb" jsonb,
	"normalization_fn" varchar(50) NOT NULL,
	"direction" varchar(50) NOT NULL,
	"source_tier_required" integer NOT NULL,
	"version_introduced" varchar(50) NOT NULL,
	CONSTRAINT "field_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "field_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"value_raw" text,
	"value_normalized" jsonb,
	"value_indicator_score" numeric(5, 2),
	"source_id" uuid,
	"provenance" jsonb,
	"status" varchar(50) NOT NULL,
	"extracted_at" timestamp DEFAULT now(),
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"methodology_version_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "methodology_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"published_at" timestamp,
	"version_tag" varchar(50) NOT NULL,
	"framework_structure" jsonb NOT NULL,
	"pillar_weights" jsonb NOT NULL,
	"sub_factor_weights" jsonb NOT NULL,
	"indicator_weights" jsonb NOT NULL,
	"normalization_choices" jsonb NOT NULL,
	"rubric_versions" jsonb NOT NULL,
	"cme_paq_split" jsonb NOT NULL,
	"change_notes" text,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "methodology_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"publication" text NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"matched_programs" jsonb,
	"summary" text,
	"triggered_review_queue_id" uuid
);
--> statement-breakpoint
ALTER TABLE "news_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"previous_value_id" uuid,
	"new_value_id" uuid,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"severity" varchar(20) NOT NULL,
	"paq_delta" numeric(5, 2),
	"summary_text" text,
	"summary_human_approved" boolean DEFAULT false,
	"wayback_url" text
);
--> statement-breakpoint
ALTER TABLE "policy_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_iso" varchar(3) NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"launch_year" integer,
	"closure_year" integer,
	"description_md" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_value_id" uuid NOT NULL,
	"flagged_reason" text NOT NULL,
	"priority" integer NOT NULL,
	"assigned_to" uuid,
	"status" varchar(50) NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "review_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"methodology_version_id" uuid NOT NULL,
	"scored_at" timestamp DEFAULT now() NOT NULL,
	"cme_score" numeric(5, 2),
	"paq_score" numeric(5, 2),
	"composite_score" numeric(5, 2),
	"pillar_scores" jsonb,
	"sub_factor_scores" jsonb,
	"data_coverage_pct" numeric(5, 2),
	"flagged_insufficient_disclosure" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scrape_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"http_status" integer,
	"content_hash" text,
	"raw_markdown_storage_path" text,
	"extraction_job_id" text,
	"status" varchar(50)
);
--> statement-breakpoint
ALTER TABLE "scrape_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensitivity_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"methodology_version_id" uuid NOT NULL,
	"run_type" varchar(50) NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"results" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sensitivity_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"url" text NOT NULL,
	"tier" integer NOT NULL,
	"source_category" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"scrape_schedule_cron" text,
	"last_scraped_at" timestamp,
	"last_content_hash" text,
	CONSTRAINT "sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_values" ADD CONSTRAINT "field_values_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_values" ADD CONSTRAINT "field_values_field_definition_id_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."field_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_values" ADD CONSTRAINT "field_values_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_values" ADD CONSTRAINT "field_values_methodology_version_id_methodology_versions_id_fk" FOREIGN KEY ("methodology_version_id") REFERENCES "public"."methodology_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "news_signals" ADD CONSTRAINT "news_signals_triggered_review_queue_id_review_queue_id_fk" FOREIGN KEY ("triggered_review_queue_id") REFERENCES "public"."review_queue"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_field_definition_id_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."field_definitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_previous_value_id_field_values_id_fk" FOREIGN KEY ("previous_value_id") REFERENCES "public"."field_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_changes" ADD CONSTRAINT "policy_changes_new_value_id_field_values_id_fk" FOREIGN KEY ("new_value_id") REFERENCES "public"."field_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "programs" ADD CONSTRAINT "programs_country_iso_countries_iso_code_fk" FOREIGN KEY ("country_iso") REFERENCES "public"."countries"("iso_code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_field_value_id_field_values_id_fk" FOREIGN KEY ("field_value_id") REFERENCES "public"."field_values"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scores" ADD CONSTRAINT "scores_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scores" ADD CONSTRAINT "scores_methodology_version_id_methodology_versions_id_fk" FOREIGN KEY ("methodology_version_id") REFERENCES "public"."methodology_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scrape_history" ADD CONSTRAINT "scrape_history_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sensitivity_runs" ADD CONSTRAINT "sensitivity_runs_methodology_version_id_methodology_versions_id_fk" FOREIGN KEY ("methodology_version_id") REFERENCES "public"."methodology_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sources" ADD CONSTRAINT "sources_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_values_prog_def" ON "field_values" USING btree ("program_id","field_definition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_values_status" ON "field_values" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_values_methodology" ON "field_values" USING btree ("methodology_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_field_values_source_id" ON "field_values" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_news_signals_review_queue" ON "news_signals" USING btree ("triggered_review_queue_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_changes_prog_detected" ON "policy_changes" USING btree ("program_id","detected_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_changes_severity" ON "policy_changes" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_changes_field_def" ON "policy_changes" USING btree ("field_definition_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_changes_prev_val" ON "policy_changes" USING btree ("previous_value_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_changes_new_val" ON "policy_changes" USING btree ("new_value_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_programs_country_iso" ON "programs" USING btree ("country_iso");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_programs_status" ON "programs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_review_queue_field_val" ON "review_queue" USING btree ("field_value_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_review_queue_status_priority" ON "review_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scores_prog_methodology" ON "scores" USING btree ("program_id","methodology_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scrape_history_source_scraped" ON "scrape_history" USING btree ("source_id","scraped_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sensitivity_runs_methodology" ON "sensitivity_runs" USING btree ("methodology_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sources_program_id" ON "sources" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sources_tier" ON "sources" USING btree ("tier");--> statement-breakpoint
CREATE POLICY "Team members can write countries" ON "countries" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read countries" ON "countries" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write field_definitions" ON "field_definitions" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read field_definitions" ON "field_definitions" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write field_values" ON "field_values" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read approved field_values" ON "field_values" AS PERMISSIVE FOR SELECT TO public USING (status = 'approved');--> statement-breakpoint
CREATE POLICY "Team members can write methodology_versions" ON "methodology_versions" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read methodology_versions" ON "methodology_versions" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write news_signals" ON "news_signals" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write policy_changes" ON "policy_changes" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read approved policy_changes" ON "policy_changes" AS PERMISSIVE FOR SELECT TO public USING (summary_human_approved = true);--> statement-breakpoint
CREATE POLICY "Team members can write programs" ON "programs" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read programs" ON "programs" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write review_queue" ON "review_queue" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write scores" ON "scores" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public read scores" ON "scores" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write scrape_history" ON "scrape_history" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write sensitivity_runs" ON "sensitivity_runs" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Team members can write sources" ON "sources" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);