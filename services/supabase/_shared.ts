// Helpers compartidos por services/supabase/*.service.ts — evitan repetir el mismo
// "dame mi sede/empresa" y "registra esto en auditoría" en cada archivo.
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";
import { useAppStore } from "@/store/app-store";

type Supabase = ReturnType<typeof createClient>;

export async function sedeActual(supabase: Supabase) {
  // La sede elegida en el selector del encabezado manda; si no hay, la del perfil.
  const elegida = useAppStore.getState().sedeActualId;
  if (elegida) return elegida;
  const { data, error } = await supabase.rpc("mi_sede_id");
  if (error) throw error;
  if (!data) throw new Error("Tu usuario no tiene una sede asignada en su perfil.");
  return data;
}

export async function empresaActual(supabase: Supabase) {
  const { data, error } = await supabase.rpc("mi_empresa_id");
  if (error) throw error;
  if (!data) throw new Error("Tu usuario no tiene una empresa asignada en su perfil.");
  return data;
}

export async function registrarAuditoria(
  supabase: Supabase,
  params: {
    accion: string;
    modulo: string;
    tablaAfectada?: string;
    registroId?: string;
    datosAnteriores?: Json;
    datosNuevos?: Json;
  },
) {
  const { error } = await supabase.rpc("fn_registrar_auditoria", {
    p_accion: params.accion,
    p_modulo: params.modulo,
    p_tabla_afectada: params.tablaAfectada ?? null,
    p_registro_id: params.registroId ?? null,
    p_datos_anteriores: params.datosAnteriores ?? null,
    p_datos_nuevos: params.datosNuevos ?? null,
  });
  // La auditoría nunca debe tumbar la operación principal que la disparó.
  if (error) console.error("No se pudo registrar la auditoría:", error.message);
}

const TAM_PAGINA = 1000;
const TAM_LOTE = 100;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Lee TODAS las filas de una consulta (PostgREST devuelve como máximo 1000 por petición).
 * La consulta debe tener un orden estable (termina en .order("id")). */
export async function leerTodo<T>(pagina: (desde: number, hasta: number) => Pagina<T>): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await pagina(desde, desde + TAM_PAGINA - 1);
    if (error) throw error;
    todas.push(...(data ?? []));
    if (!data || data.length < TAM_PAGINA) break;
  }
  return todas;
}

/** Ejecuta una consulta `.in(columna, ids)` en lotes de 100 ids: una lista larga de UUID
 * desborda el límite de la URL y la petición falla. */
export async function enLotes<I, R>(ids: I[], consulta: (lote: I[]) => Promise<R[]>): Promise<R[]> {
  const resultado: R[] = [];
  for (let i = 0; i < ids.length; i += TAM_LOTE) resultado.push(...(await consulta(ids.slice(i, i + TAM_LOTE))));
  return resultado;
}

const BARRA = String.fromCharCode(92); // barra invertida

/** Escapa el texto del usuario para usarlo dentro de un filtro `.or(...)` de PostgREST. */
export function textoParaFiltro(texto: string) {
  return texto
    .split(BARRA).join(BARRA + BARRA)
    .replace(/[%_]/g, (c) => BARRA + c)
    .replace(/[,()"]/g, " ")
    .trim();
}

/** Suma lo cobrado por medio de pago de un conjunto de ventas confirmadas, usando los pagos
 * reales (venta_pagos): una venta mixta aporta a cada uno de sus medios. Si una venta
 * antigua no tuviera renglones de pago, se usa su medio único y su total. */
export async function totalesPorMedioDePago(
  supabase: Supabase,
  ventas: Array<{ id: string; medio_pago: string; total: number }>,
): Promise<Map<string, number>> {
  const totales = new Map<string, number>();
  if (ventas.length === 0) return totales;
  const pagos = await enLotes(
    ventas.map((v) => v.id),
    (lote) =>
      leerTodo((desde, hasta) =>
        supabase.from("venta_pagos").select("id, venta_id, medio_pago, monto").in("venta_id", lote).order("id").range(desde, hasta),
      ),
  );
  const conPagos = new Set<string>();
  for (const p of pagos) {
    conPagos.add(p.venta_id);
    totales.set(p.medio_pago, (totales.get(p.medio_pago) ?? 0) + p.monto);
  }
  for (const v of ventas) {
    if (conPagos.has(v.id) || v.medio_pago === "mixto" || v.total <= 0) continue;
    totales.set(v.medio_pago, (totales.get(v.medio_pago) ?? 0) + v.total);
  }
  return totales;
}
