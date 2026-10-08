// Implementa AuditoriaService contra public.audit_logs
// (solo lectura — insert exclusivo de funciones SECURITY DEFINER, update/delete
// bloqueados a nivel de grant + trigger). No existe un campo "resultado" en el
// esquema real: todo lo que llega a audit_logs es una acción que sí se completó
// (si una RPC falla, lanza excepción antes de insertar el log), así que se reporta
// siempre como "exito".
import { createClient } from "@/lib/supabase/client";
import type { AuditoriaService } from "../auditoria.types";
import type { ModuloAuditoria } from "@/types";

export const auditoriaService: AuditoriaService = {
  async listarRegistros(filtros = {}) {
    const supabase = createClient();
    let query = supabase.from("audit_logs").select("*, profiles(nombre)").order("created_at", { ascending: false }).limit(500);

    if (filtros.usuarioId) query = query.eq("usuario_id", filtros.usuarioId);
    if (filtros.modulo) query = query.eq("modulo", filtros.modulo);
    if (filtros.fechaDesde) query = query.gte("created_at", filtros.fechaDesde);
    if (filtros.fechaHasta) query = query.lte("created_at", filtros.fechaHasta);
    if (filtros.resultado === "error") return [];

    const { data, error } = await query;
    if (error) throw error;

    let registros = data.map((row) => ({
      id: row.id,
      usuarioId: row.usuario_id ?? "",
      accion: row.accion,
      modulo: row.modulo as ModuloAuditoria,
      fecha: row.created_at,
      registroAfectadoId: row.registro_id ?? undefined,
      resultado: "exito" as const,
      nombreUsuario: row.profiles?.nombre ?? "Usuario",
    }));

    if (filtros.busqueda?.trim()) {
      const texto = filtros.busqueda.trim().toLowerCase();
      registros = registros.filter(
        (r) => r.accion.toLowerCase().includes(texto) || r.nombreUsuario.toLowerCase().includes(texto),
      );
    }

    return registros;
  },
};
