import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

// Cliente para Server Components, Server Actions y Route Handlers.
// Usa la anon key (NO la service role) — las políticas RLS se aplican con la
// identidad del usuario autenticado via cookies, exactamente igual que en el navegador.
// `cookies()` es async en Next 16, por eso esta función también lo es.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll fue llamado desde un Server Component (no desde una Server
            // Action o Route Handler) — Next no permite escribir cookies ahí.
            // Se puede ignorar si tienes proxy.ts refrescando la sesión (ver abajo).
          }
        },
      },
    },
  );
}
