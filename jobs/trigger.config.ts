import { defineConfig } from '@trigger.dev/sdk/v3';
// Phase 3.10d / F.2 — side-effect import wires the Sentry-ready error
// reporter once per task worker. captureException / captureMessage from
// any job module routes through it.
import './src/boot';

/**
 * Required environment variables — set all of these in the Trigger.dev dashboard
 * under Project → Environment Variables before deploying.
 *
 * ANTHROPIC_API_KEY        — Anthropic API key for extraction + validation LLM calls
 * PERPLEXITY_API_KEY       — Perplexity sonar-pro key for Stage 0 URL discovery
 * SCRAPER_URL              — Base URL of the Python Playwright scraper service (Cloud Run)
 * DATABASE_URL             — PostgreSQL connection string (Supabase pooler URL)
 * SUPABASE_URL             — Supabase project REST URL (used by @gtmi/db RLS policies)
 * SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (bypasses RLS for pipeline writes)
 */
export const REQUIRED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'PERPLEXITY_API_KEY',
  'SCRAPER_URL',
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export default defineConfig({
  project: 'proj_wqkutxouuojvjdzsqopp',
  dirs: ['./src/jobs'],
  maxDuration: 900,
  build: {
    extensions: [],
    conditions: ['node', 'require', 'default'],
    external: ['import-in-the-middle'],
  },
});
