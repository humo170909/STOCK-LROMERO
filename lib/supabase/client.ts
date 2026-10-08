import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

// Cliente para Client Components. Usa SOLO las claves públicas (anon key):
// es seguro exponerlo al navegador porque toda autorización real queda en
// RLS + funciones SECURITY DEFINER del lado de la base de datos.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
