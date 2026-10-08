// Implementa ConfiguracionService contra public.empresas y public.sedes. Tras escribir en
// Supabase se recarga la sesión en el store, porque los componentes leen configuracionEmpresa,
// sedes y mediosPagoActivos del store (no hacen refetch propio).
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store/app-store";
import { empresaActual } from "./_shared";
import type { ConfiguracionService } from "../configuracion.types";
import type { Database } from "@/types/database.types";

function generarCodigoSede(nombre: string) {
  const slug = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toUpperCase()
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);
  return `${slug || "SEDE"}-${Date.now().toString(36).toUpperCase()}`;
}

export const configuracionService: ConfiguracionService = {
  async actualizarEmpresa(payload) {
    const supabase = createClient();
    const empresaId = await empresaActual(supabase);

    const campos: Database["public"]["Tables"]["empresas"]["Update"] = {};
    if (payload.nombre !== undefined) campos.nombre = payload.nombre;
    if (payload.razonSocial !== undefined) campos.razon_social = payload.razonSocial;
    if (payload.documento !== undefined) campos.documento = payload.documento.trim() || null;
    if (payload.direccion !== undefined) campos.direccion = payload.direccion;
    if (payload.telefono !== undefined) campos.telefono = payload.telefono;
    if (payload.correo !== undefined) campos.correo = payload.correo;
    if (payload.logoUrl !== undefined) campos.logo_url = payload.logoUrl;
    if (payload.impuesto !== undefined) campos.impuesto = payload.impuesto;

    const { data, error } = await supabase.from("empresas").update(campos).eq("id", empresaId).select().single();
    if (error) throw error;
    if (!data) throw new Error("No se pudo actualizar: verifica que tengas permiso de administrador.");

    await useAppStore.getState().cargarSesionReal();
  },

  async actualizarMediosPagoActivos(medios) {
    if (medios.length === 0) throw new Error("Debe quedar al menos un medio de pago activo.");
    const supabase = createClient();
    const empresaId = await empresaActual(supabase);

    const { data: actual, error: lecturaError } = await supabase
      .from("empresas")
      .select("configuracion")
      .eq("id", empresaId)
      .single();
    if (lecturaError) throw lecturaError;

    const configuracionActual = (actual?.configuracion ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from("empresas")
      .update({ configuracion: { ...configuracionActual, mediosPagoActivos: medios } })
      .eq("id", empresaId);
    if (error) throw error;

    await useAppStore.getState().cargarSesionReal();
  },

  async guardarSede(payload) {
    const supabase = createClient();

    if (payload.id) {
      const { error } = await supabase
        .from("sedes")
        .update({ nombre: payload.nombre, direccion: payload.direccion, telefono: payload.telefono, estado: payload.activa ?? true })
        .eq("id", payload.id);
      if (error) throw error;
    } else {
      const empresaId = await empresaActual(supabase);
      const { error } = await supabase.from("sedes").insert({
        empresa_id: empresaId,
        nombre: payload.nombre,
        codigo: generarCodigoSede(payload.nombre),
        direccion: payload.direccion,
        telefono: payload.telefono,
        estado: payload.activa ?? true,
      });
      if (error) throw error;
    }

    await useAppStore.getState().cargarSesionReal();
  },

  async cambiarEstadoSede(id, activa) {
    if (!activa && useAppStore.getState().sedes.filter((s) => s.activa).length <= 1) {
      throw new Error("Debe quedar al menos una sede activa.");
    }
    const supabase = createClient();
    const { error } = await supabase.from("sedes").update({ estado: activa }).eq("id", id);
    if (error) throw error;

    await useAppStore.getState().cargarSesionReal();
  },

};
