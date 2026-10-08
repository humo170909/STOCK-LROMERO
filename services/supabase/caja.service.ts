// Implementa CajaService. caja_sesiones/movimientos_caja son
// solo lectura por RLS — todo lo transaccional pasa por fn_abrir_caja, fn_cerrar_caja
// y fn_registrar_movimiento_caja (SECURITY DEFINER).
import { createClient } from "@/lib/supabase/client";
import { registrarAuditoria, sedeActual } from "./_shared";
import type { CajaService, MovimientoManualPayload, ResumenCaja, TotalPorMedioPago } from "../caja.types";
import type { AperturaCierreCaja, MedioPago, MovimientoCaja } from "@/types";
import type { Database } from "@/types/database.types";

type Supabase = ReturnType<typeof createClient>;

function sesionDesdeFila(
  row: Database["public"]["Tables"]["caja_sesiones"]["Row"],
  sedeId: string,
): AperturaCierreCaja {
  return {
    id: row.id,
    sedeId,
    usuarioId: row.usuario_cierre_id ?? row.usuario_apertura_id,
    estado: row.estado,
    montoApertura: row.monto_apertura,
    montoCierreEsperado: row.monto_cierre_esperado ?? undefined,
    montoCierreReal: row.monto_cierre_real ?? undefined,
    diferencia: row.diferencia ?? undefined,
    abiertaEn: row.abierta_en,
    cerradaEn: row.cerrada_en ?? undefined,
  };
}

async function cajaDeSedeActual(supabase: Supabase, sedeId: string) {
  const { data: cajas, error } = await supabase
    .from("cajas")
    .select("*")
    .eq("sede_id", sedeId)
    .eq("estado", true)
    .order("created_at")
    .limit(1);
  if (error) throw error;
  if (cajas.length > 0) return cajas[0];

  // Solo funciona si eres administrador (RLS de cajas_insert) — para cualquier otro
  // rol, esto falla y el mensaje de abajo explica qué falta.
  const { data: nueva, error: insertError } = await supabase
    .from("cajas")
    .insert({ sede_id: sedeId, nombre: "Caja principal" })
    .select()
    .single();
  if (insertError) throw new Error("No hay una caja configurada para tu sede. Pide a un administrador que la cree.");
  return nueva;
}

const CAJA_VACIA: AperturaCierreCaja = {
  id: "",
  sedeId: "",
  usuarioId: "",
  estado: "cerrada",
  montoApertura: 0,
  abiertaEn: "",
};

export const cajaService: CajaService = {
  async obtenerResumen() {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const caja = await cajaDeSedeActual(supabase, sedeId);

    const { data: sesiones, error } = await supabase
      .from("caja_sesiones")
      .select("*")
      .eq("caja_id", caja.id)
      .order("abierta_en", { ascending: false })
      .limit(30);
    if (error) throw error;

    const sesionActualRow = sesiones.find((s) => s.estado === "abierta");
    const cajaActual = sesionActualRow ? sesionDesdeFila(sesionActualRow, sedeId) : CAJA_VACIA;
    const historial = sesiones.filter((s) => s.estado === "cerrada").map((s) => sesionDesdeFila(s, sedeId));

    let movimientosHoy: MovimientoCaja[] = [];
    if (sesionActualRow) {
      const { data: movRows, error: movError } = await supabase
        .from("movimientos_caja")
        .select("*")
        .eq("caja_sesion_id", sesionActualRow.id)
        .order("created_at", { ascending: false });
      if (movError) throw movError;
      // 'apertura' ya está contado en montoApertura y 'cierre'/'ajuste' no tienen
      // equivalente en el modelo de la maqueta — solo venta/ingreso/egreso son
      // "movimientos" visibles, igual que en la maqueta original.
      movimientosHoy = movRows
        .filter((m) => m.tipo === "venta" || m.tipo === "ingreso" || m.tipo === "egreso")
        .map((m) => ({
          id: m.id,
          tipo: m.tipo === "venta" ? "ingreso_venta" : m.tipo === "ingreso" ? "ingreso_manual" : "egreso_manual",
          medioPago: m.medio_pago,
          monto: m.monto,
          fecha: m.created_at,
          sedeId: m.sede_id,
          usuarioId: m.usuario_id,
          referenciaVentaId: m.referencia_tipo === "venta" ? (m.referencia_id ?? undefined) : undefined,
          concepto: m.concepto,
        }));
    }

    const totalesPorMedioPago: TotalPorMedioPago[] = [];
    const acumulado = new Map<MedioPago, number>();
    for (const m of movimientosHoy) {
      const signo = m.tipo === "egreso_manual" ? -1 : 1;
      acumulado.set(m.medioPago, Math.round(((acumulado.get(m.medioPago) ?? 0) + signo * m.monto) * 100) / 100);
    }
    for (const [medioPago, monto] of acumulado) totalesPorMedioPago.push({ medioPago, monto });

    const { data: resumenDia } = await supabase.rpc("fn_dashboard_resumen", { p_sede_id: sedeId });
    const fila = resumenDia?.[0];
    const ventasDelDia = fila?.ventas_dia ?? 0;
    const costoVentas = fila?.costo_dia ?? 0;
    const gananciaBruta = fila?.ganancia_dia ?? 0;
    const otrosIngresos = movimientosHoy
      .filter((m) => m.tipo === "ingreso_manual")
      .reduce((acc, m) => acc + m.monto, 0);

    const montoEsperadoEfectivo = sesionActualRow
      ? sesionActualRow.monto_apertura +
        movimientosHoy
          .filter((m) => m.medioPago === "efectivo")
          .reduce((acc, m) => acc + (m.tipo === "egreso_manual" ? -m.monto : m.monto), 0)
      : 0;

    return {
      cajaActual,
      historial,
      movimientosHoy,
      totalesPorMedioPago,
      resumen: { ventasDelDia, costoVentas, gananciaBruta, otrosIngresos, totalIngresos: ventasDelDia + otrosIngresos },
      montoEsperadoEfectivo,
    } satisfies ResumenCaja;
  },

  async registrarMovimientoManual(payload: MovimientoManualPayload) {
    const supabase = createClient();
    const { error } = await supabase.rpc("fn_registrar_movimiento_caja", {
      p_tipo: payload.tipo === "ingreso_manual" ? "ingreso" : "egreso",
      p_medio_pago: payload.medioPago,
      p_monto: payload.monto,
      p_concepto: payload.concepto,
    });
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `${payload.tipo === "ingreso_manual" ? "Ingreso" : "Egreso"} manual de caja: ${payload.concepto} (S/ ${payload.monto})`,
      modulo: "caja",
      tablaAfectada: "movimientos_caja",
    });
  },

  async abrirCaja(montoApertura) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const caja = await cajaDeSedeActual(supabase, sedeId);
    const { error } = await supabase.rpc("fn_abrir_caja", { p_caja_id: caja.id, p_monto_apertura: montoApertura });
    if (error) throw error;
  },

  async cerrarCaja(montoCierreReal) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const caja = await cajaDeSedeActual(supabase, sedeId);
    const { data: sesiones, error: sesionError } = await supabase
      .from("caja_sesiones")
      .select("id")
      .eq("caja_id", caja.id)
      .eq("estado", "abierta")
      .limit(1);
    if (sesionError) throw sesionError;
    if (!sesiones[0]) throw new Error("No hay una caja abierta para cerrar.");

    const { error } = await supabase.rpc("fn_cerrar_caja", {
      p_caja_sesion_id: sesiones[0].id,
      p_monto_cierre_real: montoCierreReal,
    });
    if (error) throw error;
  },
};
