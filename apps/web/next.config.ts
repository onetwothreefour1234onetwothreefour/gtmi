import type { NextConfig } from 'next';
import path from 'node:path';
import dotenv from 'dotenv';

// Load the monorepo-root .env at config time so RSC database queries (via
// @gtmi/db) see DATABASE_URL et al. Without this, Next bundles @gtmi/db
// and its own dotenv.config() runs against a rewritten __dirname that no
// longer resolves to the repo root.
//
// Cloud Run injects env vars directly via Secret Manager, so this is a
// no-op in production (process.env is already populated when next.config
// loads).
dotenv.config({ path: path.join(__dirname, '../../.env') });

const nextConfig: NextConfig = {
  output: 'standalone',
  // Bundle workspace packages (@gtmi/db, @gtmi/scoring) into the standalone server
  // by tracing from the monorepo root instead of just apps/web.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Phase 3.9 / W7 — @gtmi/storage uses a dynamic import of
  // @google-cloud/storage to keep the in-memory test fallback usable
  // without the dep installed. Next's webpack bundler still tries to
  // resolve it statically; tagging it as a server external means
  // require() at runtime instead of bundling. Pairs with the package
  // being declared in apps/web/package.json so node_modules has it.
  serverExternalPackages: ['@google-cloud/storage'],
};

export default nextConfig;
