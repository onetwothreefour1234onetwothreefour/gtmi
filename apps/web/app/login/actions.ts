'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signInWithMagicLink(formData: FormData): Promise<void> {
  const email = (formData.get('email') as string).trim().toLowerCase();
  const next = (formData.get('next') as string | null) ?? '/review';

  if (!email) {
    redirect(`/login?error=Email+is+required`);
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!origin) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is not set — magic-link redirect cannot be built. ' +
        'Configure it at build time (Cloud Run: via Secret Manager build arg).'
    );
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/login/check-email?email=${encodeURIComponent(email)}`);
}
