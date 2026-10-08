// Implementa MovimientosService contra
// public.movimientos_inventario (solo lectura — se escribe vía fn_ajustar_stock /
// fn_registrar_venta / fn_registrar_compra, nunca insert directo).
import { createClient } from "@/lib/supabase/client";
import { leerTodo } from "./_shared";
import type { MovimientosService } from "../movimientos.types";
import type { MovimientoInventario } from "@/types";

export const movimientosService: MovimientosService = {
  async listarMovimientos(filtros = {}) {
    const supabase = createClient();
    let query = supabase
      .from("movimientos_inventario")
      .select("*, productos(nombre)")
      .order("created_at", { ascending: false });

    if (filtros.productoId) query = query.eq("producto_id", filtros.productoId);
    if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
    if (filtros.fechaDesde) query = query.gte("created_at", filtros.fechaDesde);
    if (filtros.fechaHasta) query = query.lte("created_at", filtros.fechaHasta);

    const ordenada = query.order("id");

    const data = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));

    let movimientos: MovimientoInventario[] = data.map((row) => ({
      id: row.id,
      productoId: row.producto_id,
      nombreProducto: row.productos?.nombre ?? "Producto",
      tipo: row.tipo,
      cantidadAnterior: row.stock_anterior,
      cantidadModificada: row.cantidad,
      cantidadNueva: row.stock_nuevo,
      motivo: row.motivo ?? "",
      usuarioId: row.usuario_id ?? "",
      sedeId: row.sede_id,
      fecha: row.created_at,
      referenciaId: row.referencia_id ?? undefined,
      referenciaTipo: (row.referencia_tipo as MovimientoInventario["referenciaTipo"]) ?? undefined,
      documentoSustento: row.documento_sustento ?? undefined,
      observaciones: row.observaciones ?? undefined,
    }));

    if (filtros.busqueda?.trim()) {
      const texto = filtros.busqueda.trim().toLowerCase();
      movimientos = movimientos.filter(
        (m) => m.nombreProducto.toLowerCase().includes(texto) || m.motivo.toLowerCase().includes(texto),
      );
    }

    return movimientos;
  },

  async exportarMovimientos(filtros = {}) {
    const movimientos = await movimientosService.listarMovimientos(filtros);

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet("Movimientos");
    hoja.columns = [
      { header: "Fecha", key: "fecha", width: 18 },
      { header: "Producto", key: "producto", width: 32 },
      { header: "Tipo", key: "tipo", width: 14 },
      { header: "Cant. anterior", key: "anterior", width: 14 },
      { header: "Cant. modificada", key: "modificada", width: 16 },
      { header: "Cant. nueva", key: "nueva", width: 14 },
      { header: "Motivo", key: "motivo", width: 34 },
      { header: "Documento sustento", key: "documento", width: 22 },
      { header: "Observaciones", key: "observaciones", width: 30 },
    ];
    hoja.getRow(1).font = { bold: true };
    hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE7FF" } };

    for (const m of movimientos) {
      hoja.addRow({
        fecha: new Date(m.fecha).toLocaleString("es-PE"),
        producto: m.nombreProducto,
        tipo: m.tipo,
        anterior: m.cantidadAnterior,
        modificada: m.cantidadModificada,
        nueva: m.cantidadNueva,
        motivo: m.motivo,
        documento: m.documentoSustento ?? "",
        observaciones: m.observaciones ?? "",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },
};
