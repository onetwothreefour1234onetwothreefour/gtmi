import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/review';

  // Cloud Run's container binds to 0.0.0.0:8080 internally, so new URL(request.url).origin
  // gives us "http://0.0.0.0:8080" instead of the public domain. Use NEXT_PUBLIC_APP_URL
  // (baked in at build time) as the canonical origin for all redirects from this route.
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!origin) {
    return new NextResponse('NEXT_PUBLIC_APP_URL not configured', { status: 500 });
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could+not+sign+in`);
}
