import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Bloquea la página en el servidor (404) si el usuario no es administrador activo. */
export async function requerirAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("es_administrador");
  if (data !== true) notFound();
}

/** Bloquea la página en el servidor (404) si el rol no tiene ese permiso. */
export async function requerirPermiso(modulo: string, accion = "ver") {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_permiso", { p_modulo: modulo, p_accion: accion });
  if (data !== true) notFound();
}
