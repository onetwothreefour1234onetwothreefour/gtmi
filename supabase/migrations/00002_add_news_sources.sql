CREATE TABLE IF NOT EXISTS "news_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"publication" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "news_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "news_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "Team members can write news_sources" ON "news_sources" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);