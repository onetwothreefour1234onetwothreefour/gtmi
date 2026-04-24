import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function signOut() {
  'use server';
  const { createClient: makeClient } = await import('@/lib/supabase/server');
  const supabase = await makeClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-6 py-2 flex items-center justify-between text-sm text-gray-600">
        <span className="font-medium text-gray-800">GTMI Review</span>
        <div className="flex items-center gap-4">
          <span>{user.email}</span>
          <form action={signOut}>
            <button type="submit" className="text-gray-400 hover:text-gray-700">
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
