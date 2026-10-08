import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ADVERTENCIA: cliente con la SERVICE_ROLE_KEY. Esta clave se salta RLS por
// completo — NUNCA debe llegar al navegador ni a un componente cliente, y por
// eso este archivo importa "server-only" (falla el build si algo del cliente
// lo importa transitivamente).
//
// En esta arquitectura casi nunca deberías necesitar esto: las operaciones
// transaccionales ya están cubiertas por las funciones SECURITY DEFINER de
// 19_functions.sql (fn_registrar_venta, fn_registrar_compra, etc.), que hacen
// sus propias validaciones de permiso y se ejecutan con la identidad del
// usuario autenticado vía el cliente normal (lib/supabase/server.ts).
//
// Úsalo solo para tareas de administración de infraestructura que
// legítimamente no tienen un usuario detrás, por ejemplo:
//   - un webhook de un proveedor externo (pasarela de pagos, SUNAT) que llega
//     sin sesión de usuario y necesita escribir directamente.
//   - un cron job / Route Handler de mantenimiento (ej. marcar cotizaciones
//     vencidas) que corre sin que nadie esté "logueado".
//   - crear el primer `profile` de un usuario recién registrado si decides
//     automatizar ese paso manual descrito en supabase/migrations/README.md.
//
// Si no estás en uno de esos casos, usa lib/supabase/server.ts en su lugar.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
