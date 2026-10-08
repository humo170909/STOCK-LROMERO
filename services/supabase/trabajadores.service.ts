// Implementa TrabajadoresService contra public.trabajadores.
import { createClient } from "@/lib/supabase/client";
import { empresaActual, registrarAuditoria, textoParaFiltro } from "./_shared";
import type { TrabajadoresService } from "../trabajadores.types";
import type { Trabajador } from "@/types";
import type { Database } from "@/types/database.types";

function trabajadorDesdeFila(row: Database["public"]["Tables"]["trabajadores"]["Row"]): Trabajador {
  return {
    id: row.id,
    nombre: row.nombre,
    documento: row.documento,
    telefono: row.telefono ?? "",
    cargo: row.cargo,
    activo: row.estado,
    ingresadoEn: row.ingresado_en,
    sedeId: row.sede_id,
    usuarioId: row.profile_id ?? undefined,
  };
}

export const trabajadoresService: TrabajadoresService = {
  async listarTrabajadores(filtros = {}) {
    const supabase = createClient();
    let query = supabase.from("trabajadores").select("*").is("deleted_at", null);

    if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
    if (filtros.activo === "activos") query = query.eq("estado", true);
    if (filtros.activo === "inactivos") query = query.eq("estado", false);
    if (filtros.busqueda?.trim()) {
      const texto = textoParaFiltro(filtros.busqueda);
      if (texto) query = query.or(`nombre.ilike.%${texto}%,documento.ilike.%${texto}%`);
    }

    const { data, error } = await query.order("nombre");
    if (error) throw error;
    return data.map(trabajadorDesdeFila);
  },

  async guardarTrabajador(payload) {
    const supabase = createClient();
    const esNuevo = !payload.id;

    if (esNuevo) {
      const empresaId = await empresaActual(supabase);
      const { data, error } = await supabase
        .from("trabajadores")
        .insert({
          empresa_id: empresaId,
          sede_id: payload.sedeId,
          nombre: payload.nombre,
          documento: payload.documento,
          telefono: payload.telefono,
          cargo: payload.cargo,
          ingresado_en: payload.ingresadoEn,
          profile_id: payload.usuarioId ?? null,
          estado: payload.activo ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria(supabase, {
        accion: `Trabajador creado: ${payload.nombre}`,
        modulo: "trabajadores",
        tablaAfectada: "trabajadores",
        registroId: data.id,
      });
      return;
    }

    const { error } = await supabase
      .from("trabajadores")
      .update({
        sede_id: payload.sedeId,
        nombre: payload.nombre,
        documento: payload.documento,
        telefono: payload.telefono,
        cargo: payload.cargo,
        ingresado_en: payload.ingresadoEn,
        profile_id: payload.usuarioId ?? null,
      })
      .eq("id", payload.id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Trabajador actualizado: ${payload.nombre}`,
      modulo: "trabajadores",
      tablaAfectada: "trabajadores",
      registroId: payload.id,
    });
  },

  async cambiarEstado(id, activo) {
    const supabase = createClient();
    const { error } = await supabase.from("trabajadores").update({ estado: activo }).eq("id", id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Trabajador ${activo ? "activado" : "desactivado"}`,
      modulo: "trabajadores",
      tablaAfectada: "trabajadores",
      registroId: id,
    });
  },
};
