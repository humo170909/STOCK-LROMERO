// Implementa MetasService contra public.metas_ventas. Las ventas reales se leen de la vista
// v_ventas_por_dia (solo ventas confirmadas, día en hora de Perú, respeta RLS del usuario).
import { createClient } from "@/lib/supabase/client";
import { empresaActual, leerTodo, registrarAuditoria } from "./_shared";
import type { EstadoMeta, MetasService, ResumenMeta } from "../metas.types";

const redondear = (n: number) => Math.round(n * 100) / 100;

function claveMes(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function primerDia(anio: number, mes: number) {
  return `${claveMes(anio, mes)}-01`;
}

function ultimoDia(anio: number, mes: number) {
  return `${claveMes(anio, mes)}-${String(new Date(anio, mes, 0).getDate()).padStart(2, "0")}`;
}

function armarResumen(anio: number, mes: number, meta: number | null, ventas: number): ResumenMeta {
  const ventasRedondeadas = redondear(ventas);
  if (meta === null) {
    return { anio, mes, meta: null, ventas: ventasRedondeadas, porcentaje: null, faltante: null, estado: "sin_meta" };
  }
  const estado: EstadoMeta = ventasRedondeadas > meta ? "superada" : ventasRedondeadas === meta ? "alcanzada" : "en_progreso";
  return {
    anio,
    mes,
    meta,
    ventas: ventasRedondeadas,
    porcentaje: redondear((ventasRedondeadas / meta) * 100),
    faltante: redondear(Math.max(meta - ventasRedondeadas, 0)),
    estado,
  };
}

/** Ventas confirmadas por mes ("AAAA-MM") entre dos días. */
async function ventasPorMes(desde: string, hasta: string) {
  const supabase = createClient();
  const filas = await leerTodo((d, h) =>
    supabase
      .from("v_ventas_por_dia")
      .select("sede_id, dia, total_vendido")
      .gte("dia", desde)
      .lte("dia", hasta)
      .order("dia")
      .order("sede_id")
      .range(d, h),
  );
  const porMes = new Map<string, number>();
  for (const f of filas) {
    const clave = f.dia.slice(0, 7);
    porMes.set(clave, (porMes.get(clave) ?? 0) + f.total_vendido);
  }
  return porMes;
}

export const metasService: MetasService = {
  mesActual() {
    const [anio, mes] = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima" }).format(new Date()).split("-").map(Number);
    return { anio, mes };
  },

  async obtenerResumenMes(anio, mes) {
    const supabase = createClient();
    const { data: meta, error } = await supabase.from("metas_ventas").select("meta").eq("anio", anio).eq("mes", mes).maybeSingle();
    if (error) throw error;
    const porMes = await ventasPorMes(primerDia(anio, mes), ultimoDia(anio, mes));
    return armarResumen(anio, mes, meta?.meta ?? null, porMes.get(claveMes(anio, mes)) ?? 0);
  },

  async listarHistorial() {
    const supabase = createClient();
    const { data: metas, error } = await supabase
      .from("metas_ventas")
      .select("anio, mes, meta")
      .order("anio", { ascending: false })
      .order("mes", { ascending: false });
    if (error) throw error;
    if (metas.length === 0) return [];

    const masAntigua = metas[metas.length - 1];
    const masReciente = metas[0];
    const porMes = await ventasPorMes(primerDia(masAntigua.anio, masAntigua.mes), ultimoDia(masReciente.anio, masReciente.mes));
    return metas.map((m) => armarResumen(m.anio, m.mes, m.meta, porMes.get(claveMes(m.anio, m.mes)) ?? 0));
  },

  async guardarMeta({ anio, mes, meta }) {
    if (!Number.isFinite(meta) || meta <= 0) throw new Error("Ingresa un monto de meta mayor a 0.");
    const supabase = createClient();
    const empresaId = await empresaActual(supabase);
    const { error } = await supabase
      .from("metas_ventas")
      .upsert({ empresa_id: empresaId, anio, mes, meta: redondear(meta) }, { onConflict: "empresa_id,anio,mes" });
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Meta de ventas ${claveMes(anio, mes)} fijada en ${redondear(meta).toFixed(2)}`,
      modulo: "configuracion",
      tablaAfectada: "metas_ventas",
    });
  },
};
