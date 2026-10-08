// Protección de rutas con Supabase Auth real. Usa getUser() (no getSession())
// porque revalida el token contra el servidor de Auth en cada request, en vez
// de confiar en la cookie sin más.
//
// Nota de versión: Next.js 16 renombró `middleware` a `proxy` (node_modules/next/dist/docs/
// 01-app/03-api-reference/03-file-conventions/proxy.md). Este archivo usa la convención nueva.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    const redireccion = NextResponse.redirect(loginUrl);
    // Conserva las cookies de sesión que Supabase haya actualizado/borrado.
    supabaseResponse.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie));
    return redireccion;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!login|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
