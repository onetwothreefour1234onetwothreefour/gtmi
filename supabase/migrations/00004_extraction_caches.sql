-- scrape_cache: URL-keyed scrape content with 24-hour TTL
CREATE TABLE IF NOT EXISTS "scrape_cache" (
	"url" text PRIMARY KEY NOT NULL,
	"content_markdown" text NOT NULL,
	"content_hash" text NOT NULL,
	"http_status" integer NOT NULL,
	"scraped_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrape_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Team members can write scrape_cache" ON "scrape_cache" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);

--> statement-breakpoint

-- discovery_cache: Perplexity discovery results with 7-day TTL
CREATE TABLE IF NOT EXISTS "discovery_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"discovered_urls" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discovery_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Team members can write discovery_cache" ON "discovery_cache" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);

--> statement-breakpoint

-- extraction_cache: LLM extraction results, permanent (cache_key encodes content+field+prompt)
CREATE TABLE IF NOT EXISTS "extraction_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"result_jsonb" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extraction_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Team members can write extraction_cache" ON "extraction_cache" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);

--> statement-breakpoint

-- validation_cache: LLM validation results, permanent (cache_key encodes value+sentence+field+prompt)
CREATE TABLE IF NOT EXISTS "validation_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"result_jsonb" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "validation_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Team members can write validation_cache" ON "validation_cache" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);

--> statement-breakpoint

-- crosscheck_cache: LLM cross-check results, permanent (cache_key encodes value+tier2hash+field)
CREATE TABLE IF NOT EXISTS "crosscheck_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"result_jsonb" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crosscheck_cache" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "Team members can write crosscheck_cache" ON "crosscheck_cache" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);
