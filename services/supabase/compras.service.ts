// Implementa ComprasService. Lectura directa de
// public.compras/compra_detalles (solo SELECT por RLS); el registro de una compra pasa
// por fn_registrar_compra (SECURITY DEFINER), que aplica costeo promedio ponderado y
// bloquea filas con SELECT ... FOR UPDATE — ver 19_functions.sql.
import { createClient } from "@/lib/supabase/client";
import { leerTodo, sedeActual, textoParaFiltro } from "./_shared";
import type { ComprasService } from "../compras.types";
import type { Compra, DetalleCompra } from "@/types";
import type { Database } from "@/types/database.types";

function compraDesdeFila(row: Database["public"]["Tables"]["compras"]["Row"]): Compra {
  return {
    id: row.id,
    numeroDocumento: row.numero_documento,
    proveedorId: row.proveedor_id,
    fecha: row.fecha,
    sedeId: row.sede_id,
    subtotal: row.subtotal,
    impuesto: row.impuesto,
    total: row.total,
    estado: row.estado,
    observaciones: row.observaciones ?? undefined,
  };
}

export const comprasService: ComprasService = {
  async listarCompras(filtros = {}) {
    const supabase = createClient();
    let query = supabase.from("compras").select("*, proveedores(razon_social)").order("fecha", { ascending: false });

    if (filtros.proveedorId) query = query.eq("proveedor_id", filtros.proveedorId);
    if (filtros.estado) query = query.eq("estado", filtros.estado);
    if (filtros.fechaDesde) query = query.gte("fecha", filtros.fechaDesde);
    if (filtros.fechaHasta) query = query.lte("fecha", filtros.fechaHasta);
    if (filtros.busqueda?.trim()) query = query.ilike("numero_documento", `%${textoParaFiltro(filtros.busqueda)}%`);

    const ordenada = query.order("id");

    const data = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));

    return data.map((row) => ({
      ...compraDesdeFila(row),
      nombreProveedor: row.proveedores?.razon_social ?? "Proveedor",
    }));
  },

  async obtenerDetalleCompra(compraId) {
    const supabase = createClient();
    const { data: compra, error } = await supabase
      .from("compras")
      .select("*, proveedores(*)")
      .eq("id", compraId)
      .single();
    if (error) throw error;

    const { data: detalle, error: detalleError } = await supabase
      .from("compra_detalles")
      .select("*, productos(nombre)")
      .eq("compra_id", compraId);
    if (detalleError) throw detalleError;

    const detalleMapeado: DetalleCompra[] = detalle.map((d) => ({
      id: d.id,
      compraId: d.compra_id,
      productoId: d.producto_id,
      nombreProducto: d.productos?.nombre ?? "Producto",
      cantidad: d.cantidad,
      costoUnitario: d.costo_unitario,
      subtotal: d.subtotal,
    }));

    return {
      compra: compraDesdeFila(compra),
      detalle: detalleMapeado,
      proveedor: compra.proveedores
        ? {
            id: compra.proveedores.id,
            razonSocial: compra.proveedores.razon_social,
            documento: compra.proveedores.documento ?? "",
            telefono: compra.proveedores.telefono ?? "",
            correo: compra.proveedores.correo ?? "",
            direccion: compra.proveedores.direccion ?? "",
            contacto: compra.proveedores.contacto ?? "",
            activo: compra.proveedores.estado,
            observaciones: compra.proveedores.observaciones ?? undefined,
          }
        : null,
    };
  },

  async registrarCompra(payload) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);

    const lineas = payload.lineas.map((l) => ({
      producto_id: l.productoId,
      cantidad: l.cantidad,
      costo_unitario: l.costoUnitario,
    }));

    const { data, error } = await supabase.rpc("fn_registrar_compra", {
      p_sede_id: sedeId,
      p_proveedor_id: payload.proveedorId,
      p_numero_documento: payload.numeroDocumento,
      p_lineas: lineas,
      p_observaciones: payload.observaciones ?? null,
    });
    if (error) throw error;
    return compraDesdeFila(data);
  },
};
