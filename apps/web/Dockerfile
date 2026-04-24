# syntax=docker/dockerfile:1.6
# Multi-stage build for @gtmi/web (Next.js 15, pnpm workspace).
# Build context MUST be the monorepo root (so all workspace packages are visible).

# ---------- deps ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Copy workspace manifests only — maximizes Docker layer cache reuse.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc* ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/scoring/package.json packages/scoring/
COPY packages/shared/package.json packages/shared/
COPY packages/extraction/package.json packages/extraction/
COPY jobs/package.json jobs/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile

# ---------- builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# Source first (respects .dockerignore so node_modules is NOT copied).
COPY . .
# Then overlay the resolved node_modules from deps stage.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/scoring/node_modules ./packages/scoring/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/extraction/node_modules ./packages/extraction/node_modules

# NEXT_PUBLIC_* are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @gtmi/web build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone output includes server.js + minimal node_modules, traced from monorepo root.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 8080

CMD ["node", "apps/web/server.js"]
