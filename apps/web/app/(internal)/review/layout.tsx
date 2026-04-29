import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { InternalBadge } from '@/components/gtmi';

async function signOut() {
  'use server';
  const { createClient: makeClient } = await import('@/lib/supabase/server');
  const supabase = await makeClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Internal route shell. Phase 4-E redesign: replaces the Phase 4.1
 * neutral header bar with the editorial `<InternalBadge>` (ink surface,
 * paper text, oxblood pulse dot, mono uppercase tracking) above a
 * paper-2 chrome strip carrying the signed-in user + sign-out form.
 *
 * Auth-gated unchanged: any unauthenticated request still redirects
 * to /login. middleware.ts continues to enforce the route protection.
 */
export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-paper text-ink">
      <InternalBadge />
      <div
        className="flex items-center justify-between border-b px-8 py-2 text-data-sm"
        style={{ borderColor: 'var(--rule)', background: 'var(--paper-2)' }}
      >
        <span className="num text-ink-3" style={{ fontSize: 12 }}>
          GTMI · Editorial review
        </span>
        <div className="flex items-center gap-4">
          <span className="num text-ink-4" style={{ fontSize: 12 }}>
            {user.email}
          </span>
          <form action={signOut}>
            <button type="submit" className="btn-link text-data-sm">
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
