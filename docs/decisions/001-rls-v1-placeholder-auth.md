# 001: RLS V1 Placeholder Auth

## Context

The Global Talent Mobility Index (GTMI) database resides on Supabase and implements Row Level Security (RLS) on all 12 core tables from day one. The system requires that "Authenticated team members can write" and the public can only read specific finalized data. During the initial development phase, we do not yet have a fine-grained role-based access control (RBAC) setup or a dedicated internal user tenant configuration.

## Decision

For Phase 1 (V1), we will map the "team member" role directly to Supabase's built-in `authenticated` role (`auth.role() = 'authenticated'`). This means any user who logs into the Supabase project with a valid session will have full write permissions across the database. We explicitly mark this as a placeholder directly in the Drizzle schema definitions.

## Consequences

- **Positive:** Development and testing can proceed immediately without needing complex custom claims or secondary RBAC tables.
- **Negative/Risk:** If the platform goes public and any public user is allowed to sign up, they would automatically receive the `authenticated` role and thereby gain write access to the entire index.

## Remediation Plan

Before the public dashboard launch (Phase 4) or any public user registration is enabled, this policy must be tightened.
The remediation will replace the simple `auth.role() = 'authenticated'` check with a function that verifies the user belongs to the authorized TTR Group internal team (e.g., verifying a `team_member` boolean claim in the user's JWT, or checking an `internal_users` table).
