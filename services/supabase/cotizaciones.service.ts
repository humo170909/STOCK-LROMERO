// Implementa CotizacionesService. A diferencia de
// ventas/compras, cotizaciones SÍ admite insert/update directo desde el cliente (no
// mueve stock ni caja) — ver 22_rls.sql. Solo la conversión a venta exige la RPC
// fn_convertir_cotizacion, porque esa sí mueve stock y caja.
import { createClient } from "@/lib/supabase/client";
import { empresaActual, leerTodo, sedeActual, textoParaFiltro } from "./_shared";
import type { CotizacionesService } from "../cotizaciones.types";
import type { Cotizacion, DetalleCotizacion } from "@/types";
import type { Database } from "@/types/database.types";

function cotizacionDesdeFila(row: Database["public"]["Tables"]["cotizaciones"]["Row"]): Cotizacion {
  return {
    id: row.id,
    numero: row.numero,
    clienteId: row.cliente_id,
    usuarioId: row.usuario_id,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_vencimiento,
    condiciones: row.condiciones ?? undefined,
    subtotal: row.subtotal,
    descuento: row.descuento,
    impuesto: row.impuesto,
    total: row.total,
    // La movilidad no tiene columna propia: es lo que el total suma por encima de neto + impuesto.
    movilidad: Math.max(0, Math.round((row.total - (row.subtotal - row.descuento + row.impuesto)) * 100) / 100),
    estado: row.estado,
    ventaId: row.venta_id ?? undefined,
  };
}

export const cotizacionesService: CotizacionesService = {
  async listarCotizaciones(filtros = {}) {
    const supabase = createClient();
    let query = supabase.from("cotizaciones").select("*, clientes(nombre)").order("fecha_emision", { ascending: false });

    if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);
    if (filtros.estado) query = query.eq("estado", filtros.estado);
    if (filtros.busqueda?.trim()) query = query.ilike("numero", `%${textoParaFiltro(filtros.busqueda)}%`);

    const ordenada = query.order("id");

    const data = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));

    return data.map((row) => ({
      ...cotizacionDesdeFila(row),
      nombreCliente: row.clientes?.nombre ?? "Cliente",
    }));
  },

  async obtenerDetalleCotizacion(cotizacionId) {
    const supabase = createClient();
    const { data: cotizacion, error } = await supabase
      .from("cotizaciones")
      .select("*, clientes(nombre)")
      .eq("id", cotizacionId)
      .single();
    if (error) throw error;

    const { data: detalle, error: detalleError } = await supabase
      .from("cotizacion_detalles")
      .select("*, productos(nombre)")
      .eq("cotizacion_id", cotizacionId);
    if (detalleError) throw detalleError;

    const detalleMapeado: DetalleCotizacion[] = detalle.map((d) => ({
      id: d.id,
      cotizacionId: d.cotizacion_id,
      productoId: d.producto_id,
      nombreProducto: d.productos?.nombre ?? "Producto",
      cantidad: d.cantidad,
      precio: d.precio_unitario,
      descuento: d.descuento,
      subtotal: d.subtotal,
    }));

    return {
      cotizacion: cotizacionDesdeFila(cotizacion),
      detalle: detalleMapeado,
      nombreCliente: cotizacion.clientes?.nombre ?? "Cliente",
    };
  },

  async obtenerDatosParaPdf(cotizacionId) {
    const supabase = createClient();
    const { data: cotizacion, error } = await supabase
      .from("cotizaciones")
      .select("*, clientes(*)")
      .eq("id", cotizacionId)
      .single();
    if (error) throw error;

    const { data: detalle, error: detalleError } = await supabase
      .from("cotizacion_detalles")
      .select("*, productos(nombre, descripcion, marca, unidad_medida)")
      .eq("cotizacion_id", cotizacionId)
      .order("created_at")
      .order("id");
    if (detalleError) throw detalleError;

    const c = cotizacion.clientes;
    return {
      cotizacion: cotizacionDesdeFila(cotizacion),
      cliente: c
        ? {
            id: c.id,
            documento: c.numero_documento ?? "",
            nombre: c.nombre,
            telefono: c.telefono ?? "",
            correo: c.correo ?? "",
            direccion: c.direccion ?? "",
            activo: c.estado,
            registradoEn: c.created_at,
            lineaCredito: c.linea_credito,
            riesgo: c.riesgo,
          }
        : null,
      lineas: detalle.map((d) => ({
        id: d.id,
        cotizacionId: d.cotizacion_id,
        productoId: d.producto_id,
        nombreProducto: d.productos?.nombre ?? "Producto",
        cantidad: d.cantidad,
        precio: d.precio_unitario,
        descuento: d.descuento,
        subtotal: d.subtotal,
        unidadMedida: d.productos?.unidad_medida ?? "",
        marca: d.productos?.marca ?? undefined,
        descripcion: d.productos?.descripcion ?? undefined,
      })),
    };
  },

  async crearCotizacion(payload) {
    const supabase = createClient();
    const [empresaId, sedeId] = await Promise.all([empresaActual(supabase), sedeActual(supabase)]);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Debes iniciar sesión.");

    const { data: empresa, error: empresaError } = await supabase.from("empresas").select("impuesto").eq("id", empresaId).single();
    if (empresaError) throw empresaError;

    const productoIds = payload.lineas.map((l) => l.productoId);
    const { data: productos, error: productosError } = await supabase
      .from("productos")
      .select("id, precio_venta")
      .in("id", productoIds);
    if (productosError) throw productosError;
    const precioPorProducto = new Map(productos.map((p) => [p.id, p.precio_venta]));

    let subtotalBruto = 0;
    let descuentoTotal = 0;
    for (const linea of payload.lineas) {
      const precio = precioPorProducto.get(linea.productoId);
      if (precio === undefined) throw new Error("Uno de los productos seleccionados ya no existe.");
      subtotalBruto += precio * linea.cantidad;
      descuentoTotal += linea.descuento;
    }
    const subtotalNeto = subtotalBruto - descuentoTotal;
    const impuesto = Math.round(subtotalNeto * empresa.impuesto * 100) / 100;
    const movilidad = Number.isFinite(payload.movilidad) ? Math.max(0, Math.round((payload.movilidad ?? 0) * 100) / 100) : 0;
    const total = Math.round((subtotalNeto + impuesto + movilidad) * 100) / 100;
    const numero = `COT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    const { data: cotizacion, error } = await supabase
      .from("cotizaciones")
      .insert({
        empresa_id: empresaId,
        sede_id: sedeId,
        cliente_id: payload.clienteId,
        usuario_id: user.id,
        numero,
        fecha_vencimiento: payload.fechaVencimiento,
        condiciones: payload.condiciones ?? null,
        subtotal: Math.round(subtotalBruto * 100) / 100,
        descuento: Math.round(descuentoTotal * 100) / 100,
        impuesto,
        total,
        estado: "borrador",
      })
      .select()
      .single();
    if (error) throw error;

    const detalles = payload.lineas.map((l) => ({
      cotizacion_id: cotizacion.id,
      producto_id: l.productoId,
      cantidad: l.cantidad,
      precio_unitario: precioPorProducto.get(l.productoId)!,
      descuento: l.descuento,
    }));
    const { error: detalleError } = await supabase.from("cotizacion_detalles").insert(detalles);
    if (detalleError) throw detalleError;

    return cotizacionDesdeFila(cotizacion);
  },

  async cambiarEstado(id, estado) {
    const supabase = createClient();
    const { error } = await supabase.from("cotizaciones").update({ estado }).eq("id", id);
    if (error) throw error;
  },

  async calcularTotalConversion(cotizacionId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("cotizacion_detalles")
      .select("cantidad, descuento, productos(precio_venta)")
      .eq("cotizacion_id", cotizacionId);
    if (error) throw error;
    // Misma fórmula que fn_registrar_venta: se convierte al precio vigente de cada producto.
    const base = data.reduce((acc, d) => acc + (d.productos?.precio_venta ?? 0) * d.cantidad - d.descuento, 0);
    // La tasa se lee de la base (la misma que usa fn_registrar_venta), no del estado local,
    // para que el total mostrado coincida exactamente con el que valida el servidor.
    const empresaId = await empresaActual(supabase);
    const { data: empresa, error: empresaError } = await supabase.from("empresas").select("impuesto").eq("id", empresaId).single();
    if (empresaError) throw empresaError;
    const impuesto = Math.round(base * empresa.impuesto * 100) / 100;
    return Math.round((base + impuesto) * 100) / 100;
  },

  async convertirAVenta(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("fn_convertir_cotizacion", {
      p_cotizacion_id: payload.cotizacionId,
      p_medio_pago: payload.medioPago,
      p_pagos: payload.pagos && payload.pagos.length > 1 ? payload.pagos.map((p) => ({ medio_pago: p.medioPago, monto: p.monto })) : null,
    });
    // Error de Postgres (stock, caja cerrada, pagos que no suman…): se muestra su mensaje real.
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      numero: data.numero,
      correlativo: data.correlativo,
      fecha: data.fecha,
      clienteId: data.cliente_id,
      usuarioId: data.usuario_id,
      sedeId: data.sede_id,
      medioPago: data.medio_pago,
      subtotal: data.subtotal,
      descuento: data.descuento,
      impuesto: data.impuesto,
      total: data.total,
      costoTotal: data.costo_total,
      gananciaTotal: data.ganancia_total,
      estado: data.estado,
      observaciones: data.observaciones ?? undefined,
    };
  },
};
