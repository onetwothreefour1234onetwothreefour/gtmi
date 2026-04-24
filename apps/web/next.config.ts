import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Bundle workspace packages (@gtmi/db, @gtmi/scoring) into the standalone server
  // by tracing from the monorepo root instead of just apps/web.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
