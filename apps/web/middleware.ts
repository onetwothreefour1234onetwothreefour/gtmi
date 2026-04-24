import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must happen before any redirect checks.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect all /review routes.
  if (pathname.startsWith('/review') && !user) {
    // On Cloud Run, request.nextUrl has host "0.0.0.0:8080" (the container bind address),
    // not the public domain. Use NEXT_PUBLIC_APP_URL baked in at build time as the canonical
    // origin so Location headers point to the public URL the browser can reach.
    const base = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!base) {
      return new NextResponse('NEXT_PUBLIC_APP_URL not configured', { status: 500 });
    }
    const loginUrl = new URL('/login', base);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/review', '/review/:path*'],
};
