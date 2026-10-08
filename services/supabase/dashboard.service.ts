// Implementa DashboardService agregando sobre ventas/venta_detalles/inventario/audit_logs/notificaciones reales.
import { differenceInCalendarDays, endOfDay, format, parseISO, startOfDay, startOfMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { getEstadoStock } from "@/types";
import type { MedioPago } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { enLotes, leerTodo, sedeActual, totalesPorMedioDePago } from "./_shared";
import type { ComparacionValor, DashboardData, DashboardService, PeriodoDashboard, RangoFechas } from "../dashboard.types";

type Supabase = ReturnType<typeof createClient>;

const ETIQUETAS: Record<PeriodoDashboard["id"], string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  mes: "Este mes",
  personalizado: "Periodo personalizado",
};

function resolverRango(periodo: PeriodoDashboard): RangoFechas {
  const hoy = new Date();
  switch (periodo.id) {
    case "hoy":
      return { desde: startOfDay(hoy), hasta: endOfDay(hoy) };
    case "ayer": {
      const ayer = subDays(hoy, 1);
      return { desde: startOfDay(ayer), hasta: endOfDay(ayer) };
    }
    case "7d":
      return { desde: startOfDay(subDays(hoy, 6)), hasta: endOfDay(hoy) };
    case "30d":
      return { desde: startOfDay(subDays(hoy, 29)), hasta: endOfDay(hoy) };
    case "mes":
      return { desde: startOfMonth(hoy), hasta: endOfDay(hoy) };
    case "personalizado":
      if (!periodo.rango) throw new Error("Falta el rango de fechas personalizado.");
      return { desde: startOfDay(periodo.rango.desde), hasta: endOfDay(periodo.rango.hasta) };
  }
}

function rangoAnterior(rango: RangoFechas): RangoFechas {
  const dias = differenceInCalendarDays(rango.hasta, rango.desde) + 1;
  return { desde: startOfDay(subDays(rango.desde, dias)), hasta: endOfDay(subDays(rango.desde, 1)) };
}

function compararValor(actual: number, anterior: number): ComparacionValor {
  const variacionPct = anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 1000) / 10;
  return { actual, anterior, variacionPct };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

async function ventasEnRango(supabase: Supabase, rango: RangoFechas, sedeId: string) {
  return leerTodo((desde, hasta) =>
    supabase
      .from("ventas")
      .select("*, clientes(nombre)")
      .eq("estado", "confirmada")
      .eq("sede_id", sedeId)
      .gte("fecha", rango.desde.toISOString())
      .lte("fecha", rango.hasta.toISOString())
      .order("fecha", { ascending: false })
      .order("id")
      .range(desde, hasta),
  );
}

export const dashboardService: DashboardService = {
  async obtenerDashboard(periodo) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const rango = resolverRango(periodo);
    const rangoPrevio = rangoAnterior(rango);

    const [ventasPeriodo, ventasPeriodoPrevio] = await Promise.all([
      ventasEnRango(supabase, rango, sedeId),
      ventasEnRango(supabase, rangoPrevio, sedeId),
    ]);

    const totalVentas = round2(ventasPeriodo.reduce((acc, v) => acc + v.total, 0));
    const gananciaBruta = round2(ventasPeriodo.reduce((acc, v) => acc + v.ganancia_total, 0));
    const costoVentas = round2(ventasPeriodo.reduce((acc, v) => acc + v.costo_total, 0));
    const clientesActivos = new Set(ventasPeriodo.map((v) => v.cliente_id)).size;
    const totalVentasPrevio = round2(ventasPeriodoPrevio.reduce((acc, v) => acc + v.total, 0));
    const gananciaPrevia = round2(ventasPeriodoPrevio.reduce((acc, v) => acc + v.ganancia_total, 0));

    let detallesPeriodo: Array<{ producto_id: string; cantidad: number; subtotal: number; productos: { nombre: string } | null }> = [];
    if (ventasPeriodo.length > 0) {
      detallesPeriodo = await enLotes(
        ventasPeriodo.map((v) => v.id),
        (lote) =>
          leerTodo((desde, hasta) =>
            supabase
              .from("venta_detalles")
              .select("id, producto_id, cantidad, subtotal, productos(nombre)")
              .in("venta_id", lote)
              .order("id")
              .range(desde, hasta),
          ),
      );
    }
    const productosVendidos = detallesPeriodo.reduce((acc, d) => acc + d.cantidad, 0);

    const porDia = new Map<string, { ventas: number; ganancia: number }>();
    for (const v of ventasPeriodo) {
      const clave = format(new Date(v.fecha), "yyyy-MM-dd");
      const actual = porDia.get(clave) ?? { ventas: 0, ganancia: 0 };
      porDia.set(clave, { ventas: actual.ventas + v.total, ganancia: actual.ganancia + v.ganancia_total });
    }
    const serieVentas = [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, valores]) => ({ fecha: format(parseISO(fecha), "d MMM", { locale: es }), ventas: round2(valores.ventas), ganancia: round2(valores.ganancia) }));

    const porMedioPago = await totalesPorMedioDePago(supabase, ventasPeriodo);
    const ventasPorMedioPago = [...porMedioPago.entries()].map(([medioPago, monto]) => ({ medioPago: medioPago as MedioPago, monto: round2(monto) }));

    const porProducto = new Map<string, { nombre: string; cantidad: number; monto: number }>();
    for (const d of detallesPeriodo) {
      const actual = porProducto.get(d.producto_id) ?? { nombre: d.productos?.nombre ?? "Producto", cantidad: 0, monto: 0 };
      actual.cantidad += d.cantidad;
      actual.monto += d.subtotal;
      porProducto.set(d.producto_id, actual);
    }
    const topProductoIds = [...porProducto.entries()].sort((a, b) => b[1].cantidad - a[1].cantidad).slice(0, 5);
    let productosMasVendidos: DashboardData["productosMasVendidos"] = [];
    if (topProductoIds.length > 0) {
      const { data: productosRows, error } = await supabase
        .from("productos")
        .select("*, inventario(stock_actual, stock_minimo, costo_actual, sede_id), categorias(nombre)")
        .in("id", topProductoIds.map(([id]) => id));
      if (error) throw error;
      productosMasVendidos = topProductoIds.map(([productoId, valores]) => {
        const row = productosRows.find((p) => p.id === productoId);
        if (!row) return null;
        const inv = row.inventario.find((i) => i.sede_id === sedeId) ?? row.inventario[0];
        return {
          producto: {
            id: row.id,
            sku: row.codigo,
            codigoBarras: row.codigo_barras ?? "",
            nombre: row.nombre,
            descripcion: row.descripcion ?? "",
            categoria: row.categorias?.nombre ?? "",
            marca: row.marca ?? "",
            precioVenta: row.precio_venta,
            costo: inv?.costo_actual ?? 0,
            stockActual: inv?.stock_actual ?? 0,
            stockMinimo: inv?.stock_minimo ?? 0,
            unidad: row.unidad_medida,
            activo: row.estado,
            sedeId: inv?.sede_id ?? "",
            creadoEn: row.created_at,
          },
          cantidad: valores.cantidad,
          monto: round2(valores.monto),
        };
      }).filter((x): x is NonNullable<typeof x> => x !== null);
    }

    const { data: stockCriticoRows, error: stockError } = await supabase
      .from("productos")
      .select("*, inventario!inner(stock_actual, stock_minimo, costo_actual, sede_id), categorias(nombre)")
      .eq("estado", true)
      .eq("inventario.sede_id", sedeId)
      .order("created_at", { ascending: false });
    if (stockError) throw stockError;
    const stockCritico = stockCriticoRows
      .map((row) => {
        const inv = row.inventario[0];
        return {
          id: row.id,
          sku: row.codigo,
          codigoBarras: row.codigo_barras ?? "",
          nombre: row.nombre,
          descripcion: row.descripcion ?? "",
          categoria: row.categorias?.nombre ?? "",
          marca: row.marca ?? "",
          precioVenta: row.precio_venta,
          costo: inv?.costo_actual ?? 0,
          stockActual: inv?.stock_actual ?? 0,
          stockMinimo: inv?.stock_minimo ?? 0,
          unidad: row.unidad_medida,
          activo: row.estado,
          sedeId: inv?.sede_id ?? "",
          creadoEn: row.created_at,
        };
      })
      .filter((p) => getEstadoStock(p.stockActual, p.stockMinimo) !== "disponible")
      .sort((a, b) => a.stockActual - b.stockActual)
      .slice(0, 6);

    const { data: ultimasVentasRows, error: ultimasError } = await supabase
      .from("ventas")
      .select("*, clientes(nombre)")
      .eq("sede_id", sedeId)
      .order("fecha", { ascending: false })
      .limit(8);
    if (ultimasError) throw ultimasError;
    const ultimasVentas = ultimasVentasRows.map((v) => ({
      id: v.id,
      numero: v.numero,
      correlativo: v.correlativo,
      fecha: v.fecha,
      clienteId: v.cliente_id,
      usuarioId: v.usuario_id,
      sedeId: v.sede_id,
      medioPago: v.medio_pago,
      subtotal: v.subtotal,
      descuento: v.descuento,
      impuesto: v.impuesto,
      total: v.total,
      costoTotal: v.costo_total,
      gananciaTotal: v.ganancia_total,
      estado: v.estado,
      observaciones: v.observaciones ?? undefined,
      nombreCliente: v.clientes?.nombre ?? "Cliente",
    }));

    const { data: auditoriaRows, error: auditoriaError } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);
    if (auditoriaError) throw auditoriaError;
    const actividadReciente = auditoriaRows.map((a) => ({
      id: a.id,
      usuarioId: a.usuario_id ?? "",
      accion: a.accion,
      modulo: a.modulo as DashboardData["actividadReciente"][number]["modulo"],
      fecha: a.created_at,
      registroAfectadoId: a.registro_id ?? undefined,
      resultado: "exito" as const,
    }));

    const { data: cajaRow } = await supabase.from("cajas").select("id").eq("sede_id", sedeId).limit(1).maybeSingle();
    let estadoCaja: DashboardData["estadoCaja"] = { id: "", sedeId: "", usuarioId: "", estado: "cerrada", montoApertura: 0, abiertaEn: "" };
    if (cajaRow) {
      const { data: sesion } = await supabase
        .from("caja_sesiones")
        .select("*")
        .eq("caja_id", cajaRow.id)
        .eq("estado", "abierta")
        .limit(1)
        .maybeSingle();
      if (sesion) {
        estadoCaja = {
          id: sesion.id,
          sedeId,
          usuarioId: sesion.usuario_apertura_id,
          estado: sesion.estado,
          montoApertura: sesion.monto_apertura,
          montoCierreEsperado: sesion.monto_cierre_esperado ?? undefined,
          montoCierreReal: sesion.monto_cierre_real ?? undefined,
          diferencia: sesion.diferencia ?? undefined,
          abiertaEn: sesion.abierta_en,
          cerradaEn: sesion.cerrada_en ?? undefined,
        };
      }
    }

    const { data: notificacionesRows, error: notifError } = await supabase
      .from("notificaciones")
      .select("*")
      .eq("leida", false)
      .order("created_at", { ascending: false })
      .limit(10);
    if (notifError) throw notifError;
    const alertas = notificacionesRows.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      fecha: n.created_at,
      leida: n.leida,
      enlace: undefined,
    }));

    return {
      etiquetaPeriodo: ETIQUETAS[periodo.id],
      kpis: { totalVentas, gananciaBruta, costoVentas, productosVendidos, cantidadVentas: ventasPeriodo.length, clientesActivos },
      comparacionPeriodoAnterior: {
        ventas: compararValor(totalVentas, totalVentasPrevio),
        ganancia: compararValor(gananciaBruta, gananciaPrevia),
      },
      serieVentas,
      ventasPorMedioPago,
      productosMasVendidos,
      stockCritico,
      ultimasVentas,
      actividadReciente,
      estadoCaja,
      alertas,
    };
  },
};
