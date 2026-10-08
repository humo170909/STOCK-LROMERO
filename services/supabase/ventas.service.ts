// Implementación (Supabase) de la interfaz VentasService. La venta se crea en la base de
// datos con la función fn_registrar_venta (ver supabase/migrations/19_functions.sql).
//
// Los clientes se buscan o se registran a mano: no hay consulta a RENIEC/SUNAT.
import type { Cliente, PagoVenta, Producto, Venta } from "@/types";
import type { ConfirmarVentaPayload, RegistrarClienteRapidoPayload } from "@/store/app-store";
import type { DetalleVentaCompleto, FiltrosVentas, VentaListado, VentasService } from "../ventas.types";
import { createClient } from "@/lib/supabase/client";
import { empresaActual, leerTodo, sedeActual, textoParaFiltro } from "./_shared";
import type { Database } from "@/types/database.types";

function clienteDesdeFila(row: Database["public"]["Tables"]["clientes"]["Row"]): Cliente {
  return {
    id: row.id,
    documento: row.numero_documento ?? "",
    nombre: row.nombre,
    telefono: row.telefono ?? "",
    correo: row.correo ?? "",
    direccion: row.direccion ?? "",
    activo: row.estado,
    registradoEn: row.created_at,
    lineaCredito: row.linea_credito,
    riesgo: row.riesgo,
  };
}

function ventaDesdeFila(row: Database["public"]["Tables"]["ventas"]["Row"]): Venta {
  return {
    id: row.id,
    numero: row.numero,
    correlativo: row.correlativo,
    fecha: row.fecha,
    clienteId: row.cliente_id,
    usuarioId: row.usuario_id,
    sedeId: row.sede_id,
    medioPago: row.medio_pago,
    subtotal: row.subtotal,
    descuento: row.descuento,
    impuesto: row.impuesto,
    total: row.total,
    costoTotal: row.costo_total,
    gananciaTotal: row.ganancia_total,
    estado: row.estado,
    observaciones: row.observaciones ?? undefined,
  } as Venta;
}

export const ventasService: VentasService = {
  async buscarProductosDisponibles(query: string) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const texto = textoParaFiltro(query);

    let q = supabase
      .from("productos")
      .select("id, codigo, codigo_barras, nombre, descripcion, marca, unidad_medida, precio_venta, estado, created_at, categorias(nombre), inventario!inner(stock_actual, stock_minimo, costo_actual, sede_id)")
      .eq("estado", true)
      .eq("inventario.sede_id", sedeId)
      .gt("inventario.stock_actual", 0)
      .order("nombre")
      .limit(20);

    if (texto) {
      q = q.or(`nombre.ilike.%${texto}%,codigo.ilike.%${texto}%,codigo_barras.ilike.%${texto}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    return data.map((row): Producto => {
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
        sedeId: sedeId,
        creadoEn: row.created_at,
      };
    });
  },

  async buscarClientes(query: string) {
    const texto = textoParaFiltro(query);
    if (!texto) return [];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("estado", true)
      .or(`nombre.ilike.%${texto}%,numero_documento.ilike.%${texto}%`)
      .limit(10);
    if (error) throw error;
    return data.map(clienteDesdeFila);
  },

  async registrarClienteRapido(payload: RegistrarClienteRapidoPayload) {
    const supabase = createClient();
    const empresaId = await empresaActual(supabase);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        empresa_id: empresaId,
        numero_documento: payload.documento.trim() || null,
        nombre: payload.nombre,
        telefono: payload.telefono ?? null,
        direccion: payload.direccion ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return clienteDesdeFila(data);
  },

  async confirmarVenta(payload: ConfirmarVentaPayload) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);

    const lineas = payload.lineas.map((l) => ({
      producto_id: l.productoId,
      cantidad: l.cantidad,
      descuento: l.descuento,
    }));

    const { data, error } = await supabase.rpc("fn_registrar_venta", {
      p_sede_id: sedeId,
      p_cliente_id: payload.clienteId,
      p_medio_pago: payload.medioPago,
      p_lineas: lineas,
      p_observaciones: payload.observaciones ?? null,
      p_pagos: payload.pagos && payload.pagos.length > 1 ? payload.pagos.map((p) => ({ medio_pago: p.medioPago, monto: p.monto })) : null,
    });
    if (error) throw error;
    return ventaDesdeFila(data);
  },

  async listarVentas(filtros: FiltrosVentas = {}) {
    const supabase = createClient();
    let query = supabase
      .from("ventas")
      .select(filtros.medioPago ? "*, clientes(nombre), profiles(nombre), venta_pagos!inner(medio_pago)" : "*, clientes(nombre), profiles(nombre)")
      .order("fecha", { ascending: false });

    if (filtros.fechaDesde) query = query.gte("fecha", filtros.fechaDesde);
    if (filtros.fechaHasta) query = query.lte("fecha", filtros.fechaHasta);
    if (filtros.clienteId) query = query.eq("cliente_id", filtros.clienteId);
    if (filtros.usuarioId) query = query.eq("usuario_id", filtros.usuarioId);
    // Incluye las ventas mixtas que tengan algún pago con ese medio.
    if (filtros.medioPago) query = query.eq("venta_pagos.medio_pago", filtros.medioPago);
    if (filtros.estado) query = query.eq("estado", filtros.estado);
    if (filtros.sedeId) query = query.eq("sede_id", filtros.sedeId);
    if (filtros.montoMin !== undefined) query = query.gte("total", filtros.montoMin);
    if (filtros.montoMax !== undefined) query = query.lte("total", filtros.montoMax);
    if (filtros.busqueda?.trim()) {
      query = query.ilike("numero", `%${textoParaFiltro(filtros.busqueda)}%`);
    }

    const ordenada = query.order("id");

    const data = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));

    return (data as unknown as Array<Database["public"]["Tables"]["ventas"]["Row"] & {
      clientes: { nombre: string } | null; profiles: { nombre: string } | null;
    }>).map((row): VentaListado => ({
      ...ventaDesdeFila(row),
      nombreCliente: row.clientes?.nombre ?? "Cliente",
      nombreUsuario: row.profiles?.nombre ?? "Usuario",
    }));
  },

  async hayCajaAbierta() {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const { data: cajas, error } = await supabase.from("cajas").select("id").eq("sede_id", sedeId).eq("estado", true);
    if (error) throw error;
    if (cajas.length === 0) return false;
    const { data, error: sesionError } = await supabase
      .from("caja_sesiones")
      .select("id")
      .in("caja_id", cajas.map((c) => c.id))
      .eq("estado", "abierta")
      .limit(1);
    if (sesionError) throw sesionError;
    return data.length > 0;
  },

  async anularVenta(ventaId: string, motivo: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("fn_anular_venta", { p_venta_id: ventaId, p_motivo: motivo.trim() });
    if (error) throw error;
  },

  async obtenerDetalleVenta(ventaId: string): Promise<DetalleVentaCompleto> {
    const supabase = createClient();
    const { data: venta, error } = await supabase
      .from("ventas")
      .select("*, clientes(*), profiles(nombre)")
      .eq("id", ventaId)
      .single();
    if (error) throw error;

    const { data: detalle, error: detalleError } = await supabase
      .from("venta_detalles")
      .select("*, productos(nombre)")
      .eq("venta_id", ventaId);
    if (detalleError) throw detalleError;

    const row = venta as unknown as Database["public"]["Tables"]["ventas"]["Row"] & {
      clientes: Database["public"]["Tables"]["clientes"]["Row"] | null;
      profiles: { nombre: string } | null;
    };

    const { data: pagosRows, error: pagosError } = await supabase
      .from("venta_pagos")
      .select("medio_pago, monto")
      .eq("venta_id", ventaId)
      .order("created_at")
      .order("id");
    if (pagosError) throw pagosError;
    const ventaMapeada = ventaDesdeFila(row);
    let pagos: PagoVenta[] = pagosRows.map((p) => ({ medioPago: p.medio_pago, monto: p.monto }));
    // Venta anterior sin renglones de pago: un único pago por el total.
    if (pagos.length === 0 && ventaMapeada.total > 0 && ventaMapeada.medioPago !== "mixto") {
      pagos = [{ medioPago: ventaMapeada.medioPago, monto: ventaMapeada.total }];
    }

    return {
      venta: ventaMapeada,
      detalle: (detalle as unknown as Array<Database["public"]["Tables"]["venta_detalles"]["Row"] & { productos: { nombre: string } | null }>).map((d) => ({
        id: d.id,
        ventaId: d.venta_id,
        productoId: d.producto_id,
        nombreProducto: d.productos?.nombre ?? "Producto",
        cantidad: d.cantidad,
        precioHistorico: d.precio_unitario,
        costoHistorico: d.costo_unitario,
        descuento: d.descuento,
        subtotal: d.subtotal,
        ganancia: d.ganancia,
      })),
      cliente: row.clientes ? clienteDesdeFila(row.clientes) : null,
      nombreUsuario: row.profiles?.nombre ?? "Usuario",
      pagos,
    };
  },
};
