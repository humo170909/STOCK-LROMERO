"use server";

import { createClient } from "@/lib/supabase/server";
import { ejecutarBackup, type FormatoBackup } from "@/lib/backups/backup";

// Server Actions de Configuración > Backups. Cada una vuelve a verificar en el servidor que el
// usuario autenticado es administrador (las acciones son endpoints públicos: no basta con que
// la pantalla esté oculta) y trabaja con el cliente del usuario, así que RLS sigue aplicando.

export type BackupItem = {
  id: string;
  fecha: string;
  tipo: "manual" | "automatico";
  formatos: string[];
  estado: "procesando" | "completado" | "error";
  usuario: string;
  tamanoBytes: number;
  archivos: { nombre: string; ruta: string; formato: string; tamano: number }[];
  resumen: {
    productos: number;
    ventas: number;
    ventas_anuladas: number;
    total_vendido: number;
    costo_total: number;
    ganancia_bruta: number;
  } | null;
};

async function contextoAdmin() {
  const supabase = await createClient();
  const { data: esAdmin } = await supabase.rpc("es_administrador");
  if (esAdmin !== true) return null;
  const [{ data: sesion }, { data: empresaId }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("mi_empresa_id")]);
  if (!sesion.user || !empresaId) return null;
  return { supabase, usuarioId: sesion.user.id, empresaId };
}

export async function listarBackups(): Promise<{ ok: true; items: BackupItem[] } | { ok: false }> {
  const ctx = await contextoAdmin();
  if (!ctx) return { ok: false };
  const { data, error } = await ctx.supabase
    .from("backups")
    .select("*, profiles(nombre)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false };
  return {
    ok: true,
    items: data.map((b) => ({
      id: b.id,
      fecha: b.created_at,
      tipo: b.tipo,
      formatos: b.formatos,
      estado: b.estado,
      usuario: b.profiles?.nombre ?? "Sistema",
      tamanoBytes: b.tamano_bytes,
      archivos: (b.archivos ?? []) as BackupItem["archivos"],
      resumen: (b.resumen ?? null) as BackupItem["resumen"],
    })),
  };
}

export async function crearBackup(formatos: string[]): Promise<{ ok: boolean }> {
  const ctx = await contextoAdmin();
  const validos = formatos.filter((f): f is FormatoBackup => f === "xlsx" || f === "csv");
  if (!ctx || validos.length === 0) return { ok: false };
  try {
    const resultado = await ejecutarBackup({
      supabase: ctx.supabase,
      empresaId: ctx.empresaId,
      tipo: "manual",
      formatos: [...new Set(validos)],
      usuarioId: ctx.usuarioId,
    });
    await ctx.supabase.rpc("fn_registrar_auditoria", {
      p_accion: `Backup manual creado (${validos.join(", ")})`,
      p_modulo: "configuracion",
      p_tabla_afectada: "backups",
      p_registro_id: resultado.id,
    });
    return { ok: true };
  } catch (error) {
    console.error("Backup fallido:", error);
    return { ok: false };
  }
}

export async function urlDescargaBackup(backupId: string, ruta: string): Promise<{ ok: true; url: string } | { ok: false }> {
  const ctx = await contextoAdmin();
  if (!ctx) return { ok: false };
  const { data: backup } = await ctx.supabase.from("backups").select("archivos").eq("id", backupId).single();
  const archivo = ((backup?.archivos ?? []) as BackupItem["archivos"]).find((a) => a.ruta === ruta);
  if (!archivo) return { ok: false };
  const { data, error } = await ctx.supabase.storage.from("backups").createSignedUrl(ruta, 60, { download: archivo.nombre });
  if (error || !data) return { ok: false };
  return { ok: true, url: data.signedUrl };
}
