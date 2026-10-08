"use client";

import { tienePermiso, useAppStore } from "@/store/app-store";

/** Muestra su contenido solo si el rol del usuario tiene ese permiso (por defecto "ver").
 * Solo oculta opciones: la seguridad real la aplica la base de datos. */
export function Permitido({
  modulo,
  accion = "ver",
  children,
}: {
  modulo: string;
  accion?: string;
  children: React.ReactNode;
}) {
  const permitido = useAppStore((s) => tienePermiso(s.permisos, modulo, accion));
  return permitido ? <>{children}</> : null;
}
