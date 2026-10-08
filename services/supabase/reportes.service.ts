// Implementa ReportesService agregando directamente sobre
// ventas/venta_detalles, compras/compra_detalles e inventario — con RLS ya aplicado
// (cada usuario solo agrega lo que puede ver). Las views de 21_views.sql (sin filtro
// de fecha) sirven para el Dashboard; aquí se recalculan los totales en memoria para
// poder filtrar por cualquier rango de fechas que pida el usuario.
import { createClient } from "@/lib/supabase/client";
import { enLotes, leerTodo, totalesPorMedioDePago } from "./_shared";
import { format, startOfWeek } from "date-fns";
import type {
  AgrupacionCostoGanancia,
  FiltrosReporte,
  ReportesService,
  ReporteCompras,
  ReporteCostoGanancia,
  ReporteInventario,
  ReporteVentas,
} from "../reportes.types";
import { getEstadoStock } from "@/types";

type Supabase = ReturnType<typeof createClient>;

type DetalleReporte = { venta_id: string; producto_id: string; cantidad: number; subtotal: number; costo_total: number; ganancia: number; productos: { nombre: string } | null };

async function ventasConDetalle(supabase: Supabase, filtros: FiltrosReporte) {
  const ventas = await leerTodo((desde, hasta) => {
    let query = supabase
      .from("ventas")
      .select("*, profiles(nombre), clientes(nombre)")
      .eq("estado", "confirmada")
      .gte("fecha", filtros.fechaDesde)
      .lte("fecha", filtros.fechaHasta);
    if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
    if (filtros.usuarioId) query = query.eq("usuario_id", filtros.usuarioId);
    return query.order("fecha").order("id").range(desde, hasta);
  });
  if (ventas.length === 0) return { ventas: [], detalles: [] as DetalleReporte[] };

  const detallesTodos = await enLotes(
    ventas.map((v) => v.id),
    (lote) =>
      leerTodo((desde, hasta) => {
        let detalleQuery = supabase
          .from("venta_detalles")
          .select("id, venta_id, producto_id, cantidad, subtotal, costo_total, ganancia, productos(nombre, categorias(nombre))")
          .in("venta_id", lote);
        if (filtros.productoId) detalleQuery = detalleQuery.eq("producto_id", filtros.productoId);
        return detalleQuery.order("id").range(desde, hasta);
      }),
  );

  let detalles = detallesTodos as unknown as Array<
    DetalleReporte & { productos: { nombre: string; categorias: { nombre: string } | null } | null }
  >;
  if (filtros.categoria) detalles = detalles.filter((d) => d.productos?.categorias?.nombre === filtros.categoria);

  // Con filtro de producto o categoría solo cuentan las ventas que contienen esas líneas.
  if (filtros.productoId || filtros.categoria) {
    const conLineas = new Set(detalles.map((d) => d.venta_id));
    return { ventas: ventas.filter((v) => conLineas.has(v.id)), detalles };
  }
  return { ventas, detalles };
}

export const reportesService: ReportesService = {
  async obtenerReporteVentas(filtros: FiltrosReporte): Promise<ReporteVentas> {
    const supabase = createClient();
    const { ventas, detalles } = await ventasConDetalle(supabase, filtros);

    const totales = ventas.reduce(
      (acc, v) => ({
        cantidadVentas: acc.cantidadVentas + 1,
        totalVendido: acc.totalVendido + v.total,
        totalCosto: acc.totalCosto + v.costo_total,
        totalGanancia: acc.totalGanancia + v.ganancia_total,
      }),
      { cantidadVentas: 0, totalVendido: 0, totalCosto: 0, totalGanancia: 0 },
    );

    const porDiaMap = new Map<string, { cantidadVentas: number; totalVentas: number; totalCosto: number; totalGanancia: number }>();
    for (const v of ventas) {
      const fecha = format(new Date(v.fecha), "yyyy-MM-dd");
      const actual = porDiaMap.get(fecha) ?? { cantidadVentas: 0, totalVentas: 0, totalCosto: 0, totalGanancia: 0 };
      actual.cantidadVentas += 1;
      actual.totalVentas += v.total;
      actual.totalCosto += v.costo_total;
      actual.totalGanancia += v.ganancia_total;
      porDiaMap.set(fecha, actual);
    }

    const porProductoMap = new Map<string, { nombreProducto: string; cantidad: number; monto: number }>();
    for (const d of detalles) {
      const actual = porProductoMap.get(d.producto_id) ?? { nombreProducto: d.productos?.nombre ?? "Producto", cantidad: 0, monto: 0 };
      actual.cantidad += d.cantidad;
      actual.monto += d.subtotal;
      porProductoMap.set(d.producto_id, actual);
    }

    const porClienteMap = new Map<string, { nombreCliente: string; cantidadVentas: number; totalVenta: number }>();
    const porTrabajadorMap = new Map<string, { nombreUsuario: string; cantidadVentas: number; totalVenta: number }>();
    const porMedioPagoMap = await totalesPorMedioDePago(supabase, ventas);
    for (const v of ventas) {
      const cli = porClienteMap.get(v.cliente_id) ?? { nombreCliente: v.clientes?.nombre ?? "Cliente", cantidadVentas: 0, totalVenta: 0 };
      cli.cantidadVentas += 1;
      cli.totalVenta += v.total;
      porClienteMap.set(v.cliente_id, cli);

      const trab = porTrabajadorMap.get(v.usuario_id) ?? { nombreUsuario: v.profiles?.nombre ?? "Usuario", cantidadVentas: 0, totalVenta: 0 };
      trab.cantidadVentas += 1;
      trab.totalVenta += v.total;
      porTrabajadorMap.set(v.usuario_id, trab);

    }

    return {
      totales,
      porDia: [...porDiaMap.entries()].map(([fecha, v]) => ({ fecha, ...v })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
      porProducto: [...porProductoMap.entries()].map(([productoId, v]) => ({ productoId, ...v })).sort((a, b) => b.monto - a.monto),
      porCliente: [...porClienteMap.entries()].map(([clienteId, v]) => ({ clienteId, ...v })).sort((a, b) => b.totalVenta - a.totalVenta),
      porTrabajador: [...porTrabajadorMap.entries()].map(([usuarioId, v]) => ({ usuarioId, ...v })).sort((a, b) => b.totalVenta - a.totalVenta),
      porMedioPago: [...porMedioPagoMap.entries()].map(([medioPago, monto]) => ({ medioPago: medioPago as ReporteVentas["porMedioPago"][number]["medioPago"], monto })),
    };
  },

  async obtenerReporteInventario(filtros: FiltrosReporte): Promise<ReporteInventario> {
    const supabase = createClient();
    let query = supabase
      .from("productos")
      .select("*, inventario!inner(stock_actual, stock_minimo, costo_actual, sede_id), categorias(nombre)")
      .eq("estado", true)
      .is("deleted_at", null);
    if (filtros.sedeId) query = query.eq("inventario.sede_id", filtros.sedeId);

    const ordenada = query.order("id");

    const productos = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));

    const stockActual = productos.map((p) => {
      const totalStock = p.inventario.reduce((a, i) => a + i.stock_actual, 0);
      const inv =
        p.inventario.length > 1
          ? {
              stock_actual: totalStock,
              stock_minimo: p.inventario.reduce((a, i) => a + i.stock_minimo, 0),
              costo_actual: p.inventario.reduce((a, i) => a + i.costo_actual * i.stock_actual, 0) / Math.max(1, totalStock),
              sede_id: "",
            }
          : p.inventario[0];
      const producto = {
        id: p.id,
        sku: p.codigo,
        codigoBarras: p.codigo_barras ?? "",
        nombre: p.nombre,
        descripcion: p.descripcion ?? "",
        categoria: p.categorias?.nombre ?? "",
        marca: p.marca ?? "",
        precioVenta: p.precio_venta,
        costo: inv?.costo_actual ?? 0,
        stockActual: inv?.stock_actual ?? 0,
        stockMinimo: inv?.stock_minimo ?? 0,
        unidad: p.unidad_medida,
        activo: p.estado,
        sedeId: inv?.sede_id ?? "",
        creadoEn: p.created_at,
      };
      return {
        producto,
        estado: getEstadoStock(producto.stockActual, producto.stockMinimo),
        valorCosto: producto.costo * producto.stockActual,
        valorVenta: producto.precioVenta * producto.stockActual,
      };
    });

    const totales = stockActual.reduce(
      (acc, v) => ({
        unidades: acc.unidades + v.producto.stockActual,
        valorCosto: acc.valorCosto + v.valorCosto,
        valorVenta: acc.valorVenta + v.valorVenta,
      }),
      { unidades: 0, valorCosto: 0, valorVenta: 0 },
    );

    const movimientos = await leerTodo((desde, hasta) => {
      let movQuery = supabase.from("movimientos_inventario").select("id, tipo").gte("created_at", filtros.fechaDesde).lte("created_at", filtros.fechaHasta);
      if (filtros.sedeId) movQuery = movQuery.eq("sede_id", filtros.sedeId);
      return movQuery.order("id").range(desde, hasta);
    });
    const porTipo = new Map<string, number>();
    for (const m of movimientos) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);

    return {
      totales,
      stockActual,
      stockBajo: stockActual.filter((v) => v.estado === "stock_bajo").map((v) => v.producto),
      agotados: stockActual.filter((v) => v.estado === "agotado").map((v) => v.producto),
      movimientosPorTipo: [...porTipo.entries()].map(([tipo, cantidad]) => ({
        tipo: tipo as ReporteInventario["movimientosPorTipo"][number]["tipo"],
        cantidad,
      })),
    };
  },

  async obtenerReporteCompras(filtros: FiltrosReporte): Promise<ReporteCompras> {
    const supabase = createClient();
    const compras = await leerTodo((desde, hasta) => {
      let query = supabase
        .from("compras")
        .select("*, proveedores(razon_social)")
        .eq("estado", "registrada")
        .gte("fecha", filtros.fechaDesde)
        .lte("fecha", filtros.fechaHasta);
      if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
      return query.order("fecha").order("id").range(desde, hasta);
    });

    const totales = compras.reduce(
      (acc, c) => ({ cantidadCompras: acc.cantidadCompras + 1, totalComprado: acc.totalComprado + c.total }),
      { cantidadCompras: 0, totalComprado: 0 },
    );

    const porPeriodoMap = new Map<string, { cantidadCompras: number; totalCompras: number }>();
    const porProveedorMap = new Map<string, { nombreProveedor: string; cantidadCompras: number; totalCompras: number }>();
    for (const c of compras) {
      const fecha = format(new Date(c.fecha), "yyyy-MM-dd");
      const dia = porPeriodoMap.get(fecha) ?? { cantidadCompras: 0, totalCompras: 0 };
      dia.cantidadCompras += 1;
      dia.totalCompras += c.total;
      porPeriodoMap.set(fecha, dia);

      const prov = porProveedorMap.get(c.proveedor_id) ?? { nombreProveedor: c.proveedores?.razon_social ?? "Proveedor", cantidadCompras: 0, totalCompras: 0 };
      prov.cantidadCompras += 1;
      prov.totalCompras += c.total;
      porProveedorMap.set(c.proveedor_id, prov);
    }

    let porProducto: ReporteCompras["porProducto"] = [];
    if (compras.length > 0) {
      const detalles = await enLotes(
        compras.map((c) => c.id),
        (lote) =>
          leerTodo((desde, hasta) =>
            supabase
              .from("compra_detalles")
              .select("id, producto_id, cantidad, subtotal, productos(nombre)")
              .in("compra_id", lote)
              .order("id")
              .range(desde, hasta),
          ),
      );
      const porProductoMap = new Map<string, { nombreProducto: string; cantidad: number; totalCosto: number }>();
      for (const d of detalles) {
        const actual = porProductoMap.get(d.producto_id) ?? { nombreProducto: d.productos?.nombre ?? "Producto", cantidad: 0, totalCosto: 0 };
        actual.cantidad += d.cantidad;
        actual.totalCosto += d.subtotal;
        porProductoMap.set(d.producto_id, actual);
      }
      porProducto = [...porProductoMap.entries()].map(([productoId, v]) => ({ productoId, ...v }));
    }

    return {
      totales,
      porPeriodo: [...porPeriodoMap.entries()].map(([fecha, v]) => ({ fecha, ...v })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
      porProveedor: [...porProveedorMap.entries()].map(([proveedorId, v]) => ({ proveedorId, ...v })).sort((a, b) => b.totalCompras - a.totalCompras),
      porProducto,
    };
  },

  async obtenerReporteCostoGanancia(filtros: FiltrosReporte, agrupacion: AgrupacionCostoGanancia): Promise<ReporteCostoGanancia> {
    const supabase = createClient();
    const { detalles, ventas } = await ventasConDetalle(supabase, filtros);
    const fechaPorVenta = new Map(ventas.map((v) => [v.id, v.fecha]));

    function grupoDe(fechaISO: string) {
      const fecha = new Date(fechaISO);
      if (agrupacion === "dia") return format(fecha, "yyyy-MM-dd");
      if (agrupacion === "mes") return format(fecha, "yyyy-MM");
      if (agrupacion === "semana") return format(startOfWeek(fecha, { weekStartsOn: 1 }), "yyyy-MM-dd");
      return "rango completo";
    }

    const filasMap = new Map<string, ReporteCostoGanancia["filas"][number]>();
    for (const d of detalles) {
      const fechaVenta = fechaPorVenta.get(d.venta_id);
      if (!fechaVenta) continue;
      const grupo = grupoDe(fechaVenta);
      const clave = `${grupo}:${d.producto_id}`;
      const existente = filasMap.get(clave);
      const precioUnitario = d.cantidad > 0 ? d.subtotal / d.cantidad : 0;
      const costoUnitario = d.cantidad > 0 ? d.costo_total / d.cantidad : 0;
      if (existente) {
        existente.cantidadVendida += d.cantidad;
        existente.ventaTotal += d.subtotal;
        existente.costoTotal += d.costo_total;
        existente.ganancia += d.ganancia;
      } else {
        filasMap.set(clave, {
          grupo,
          productoId: d.producto_id,
          nombreProducto: d.productos?.nombre ?? "Producto",
          cantidadVendida: d.cantidad,
          precioVenta: precioUnitario,
          costoUnitario,
          ventaTotal: d.subtotal,
          costoTotal: d.costo_total,
          ganancia: d.ganancia,
        });
      }
    }

    const filas = [...filasMap.values()]
      .map((f) => ({
        ...f,
        precioVenta: f.cantidadVendida > 0 ? f.ventaTotal / f.cantidadVendida : 0,
        costoUnitario: f.cantidadVendida > 0 ? f.costoTotal / f.cantidadVendida : 0,
      }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo));
    // Ojo: aquí "vendido" es la suma de líneas (sin impuesto); "Ventas" suma ventas.total (con impuesto).
    // Coinciden mientras el impuesto de la empresa sea 0 (valor por defecto).
    const totalVendido = filas.reduce((acc, f) => acc + f.ventaTotal, 0);
    const costoTotal = filas.reduce((acc, f) => acc + f.costoTotal, 0);
    const gananciaTotal = filas.reduce((acc, f) => acc + f.ganancia, 0);

    return {
      filas,
      totales: { totalVendido, costoTotal, gananciaTotal, margenPct: totalVendido > 0 ? (gananciaTotal / totalVendido) * 100 : 0 },
    };
  },

  async exportarReporte(tipo, filtros) {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet("Reporte");

    if (tipo === "ventas") {
      const reporte = await reportesService.obtenerReporteVentas(filtros);
      hoja.columns = [
        { header: "Fecha", key: "fecha", width: 16 },
        { header: "Cantidad de ventas", key: "cantidad", width: 18 },
        { header: "Total vendido", key: "total", width: 16 },
        { header: "Costo", key: "costo", width: 16 },
        { header: "Ganancia", key: "ganancia", width: 16 },
      ];
      reporte.porDia.forEach((fila) =>
        hoja.addRow({ fecha: fila.fecha, cantidad: fila.cantidadVentas, total: fila.totalVentas, costo: fila.totalCosto, ganancia: fila.totalGanancia }),
      );
    } else if (tipo === "inventario") {
      const reporte = await reportesService.obtenerReporteInventario(filtros);
      hoja.columns = [
        { header: "SKU", key: "sku", width: 14 },
        { header: "Producto", key: "producto", width: 32 },
        { header: "Stock actual", key: "stock", width: 14 },
        { header: "Valor costo", key: "valorCosto", width: 16 },
        { header: "Valor venta", key: "valorVenta", width: 16 },
      ];
      reporte.stockActual.forEach((fila) =>
        hoja.addRow({ sku: fila.producto.sku, producto: fila.producto.nombre, stock: fila.producto.stockActual, valorCosto: fila.valorCosto, valorVenta: fila.valorVenta }),
      );
    } else if (tipo === "compras") {
      const reporte = await reportesService.obtenerReporteCompras(filtros);
      hoja.columns = [
        { header: "Fecha", key: "fecha", width: 16 },
        { header: "Cantidad de compras", key: "cantidad", width: 18 },
        { header: "Total comprado", key: "total", width: 16 },
      ];
      reporte.porPeriodo.forEach((fila) => hoja.addRow({ fecha: fila.fecha, cantidad: fila.cantidadCompras, total: fila.totalCompras }));
    } else {
      const reporte = await reportesService.obtenerReporteCostoGanancia(filtros, "dia");
      hoja.columns = [
        { header: "Grupo", key: "grupo", width: 16 },
        { header: "Producto", key: "producto", width: 32 },
        { header: "Cantidad vendida", key: "cantidad", width: 16 },
        { header: "Venta total", key: "venta", width: 16 },
        { header: "Costo total", key: "costo", width: 16 },
        { header: "Ganancia", key: "ganancia", width: 16 },
      ];
      reporte.filas.forEach((fila) =>
        hoja.addRow({ grupo: fila.grupo, producto: fila.nombreProducto, cantidad: fila.cantidadVendida, venta: fila.ventaTotal, costo: fila.costoTotal, ganancia: fila.ganancia }),
      );
    }

    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE7FF" } };
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },
};
