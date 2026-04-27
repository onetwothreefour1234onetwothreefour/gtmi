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
};

export default nextConfig;
