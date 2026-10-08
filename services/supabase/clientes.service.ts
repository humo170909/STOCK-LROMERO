// Implementa ClientesService contra public.clientes +
// public.ventas (para los totales de compra). Mismo patrón que productos/ventas.
import { differenceInCalendarDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { empresaActual, enLotes, leerTodo, registrarAuditoria, textoParaFiltro } from "./_shared";
import { DIAS_INACTIVIDAD_CLIENTE, type ClientesService, type ExpedienteCliente } from "../clientes.types";
import type { Cliente } from "@/types";
import type { Database } from "@/types/database.types";

type ClienteRow = Database["public"]["Tables"]["clientes"]["Row"];

function clienteDesdeFila(row: ClienteRow): Cliente {
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

export const clientesService: ClientesService = {
  async listarClientes(filtros = {}) {
    const supabase = createClient();
    let query = supabase.from("clientes").select("*").is("deleted_at", null);

    if (filtros.activo === "activos") query = query.eq("estado", true);
    if (filtros.activo === "inactivos") query = query.eq("estado", false);
    if (filtros.riesgo) query = query.eq("riesgo", filtros.riesgo);
    if (filtros.busqueda?.trim()) {
      const texto = textoParaFiltro(filtros.busqueda);
      if (texto) query = query.or(`nombre.ilike.%${texto}%,numero_documento.ilike.%${texto}%`);
    }

    const ordenada = query.order("nombre").order("id");

    const clientesRows = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));
    if (clientesRows.length === 0) return [];

    const ids = clientesRows.map((c) => c.id);
    const ventasRows = await enLotes(ids, (lote) =>
      leerTodo((desde, hasta) =>
        supabase
          .from("ventas")
          .select("id, cliente_id, total, fecha")
          .eq("estado", "confirmada")
          .in("cliente_id", lote)
          .order("id")
          .range(desde, hasta),
      ),
    );

    const porCliente = new Map<string, { total: number; count: number; ultima: string | null }>();
    for (const v of ventasRows) {
      const actual = porCliente.get(v.cliente_id) ?? { total: 0, count: 0, ultima: null as string | null };
      actual.total += v.total;
      actual.count += 1;
      if (!actual.ultima || new Date(v.fecha) > new Date(actual.ultima)) actual.ultima = v.fecha;
      porCliente.set(v.cliente_id, actual);
    }

    return clientesRows
      .map((row) => {
        const resumen = porCliente.get(row.id) ?? { total: 0, count: 0, ultima: null };
        const diasSinComprar = resumen.ultima ? differenceInCalendarDays(new Date(), new Date(resumen.ultima)) : null;
        const inactivoPorCompra = diasSinComprar === null ? true : diasSinComprar > DIAS_INACTIVIDAD_CLIENTE;
        return {
          ...clienteDesdeFila(row),
          totalComprado: resumen.total,
          numeroCompras: resumen.count,
          ultimaCompra: resumen.ultima,
          inactivoPorCompra,
        };
      })
      .filter((c) => !filtros.soloInactivosPorCompra || c.inactivoPorCompra);
  },

  async obtenerExpediente(clienteId) {
    const supabase = createClient();
    const { data: clienteRow, error } = await supabase.from("clientes").select("*").eq("id", clienteId).single();
    if (error) throw error;

    const { data: ventasRows, error: ventasError } = await supabase
      .from("ventas")
      .select("*")
      .eq("cliente_id", clienteId)
      .eq("estado", "confirmada")
      .order("fecha", { ascending: false });
    if (ventasError) throw ventasError;

    const totalComprado = ventasRows.reduce((acc, v) => acc + v.total, 0);
    const ultimaCompra = ventasRows[0]?.fecha ?? null;
    const diasSinComprar = ultimaCompra ? differenceInCalendarDays(new Date(), new Date(ultimaCompra)) : null;
    const inactivoPorCompra = diasSinComprar === null ? true : diasSinComprar > DIAS_INACTIVIDAD_CLIENTE;

    const ventaIds = ventasRows.map((v) => v.id);
    const productosComprados: ExpedienteCliente["productosComprados"] = [];
    if (ventaIds.length > 0) {
      const detalles = await enLotes(ventaIds, (lote) =>
        leerTodo((desde, hasta) =>
          supabase
            .from("venta_detalles")
            .select("id, producto_id, cantidad, subtotal, productos(*)")
            .in("venta_id", lote)
            .order("id")
            .range(desde, hasta),
        ),
      );

      const porProducto = new Map<string, { cantidad: number; monto: number; producto: typeof detalles[number]["productos"] }>();
      for (const d of detalles) {
        if (!d.productos) continue;
        const actual = porProducto.get(d.producto_id) ?? { cantidad: 0, monto: 0, producto: d.productos };
        actual.cantidad += d.cantidad;
        actual.monto += d.subtotal;
        porProducto.set(d.producto_id, actual);
      }
      for (const [, valores] of porProducto) {
        if (!valores.producto) continue;
        productosComprados.push({
          producto: {
            id: valores.producto.id,
            sku: valores.producto.codigo,
            codigoBarras: valores.producto.codigo_barras ?? "",
            nombre: valores.producto.nombre,
            descripcion: valores.producto.descripcion ?? "",
            categoria: "",
            marca: valores.producto.marca ?? "",
            precioVenta: valores.producto.precio_venta,
            costo: 0,
            stockActual: 0,
            stockMinimo: 0,
            unidad: valores.producto.unidad_medida,
            activo: valores.producto.estado,
            sedeId: "",
            creadoEn: valores.producto.created_at,
          },
          cantidad: valores.cantidad,
          monto: valores.monto,
        });
      }
      productosComprados.sort((a, b) => b.monto - a.monto);
    }

    return {
      cliente: clienteDesdeFila(clienteRow),
      totalComprado,
      numeroCompras: ventasRows.length,
      ultimaCompra,
      diasSinComprar,
      inactivoPorCompra,
      historial: ventasRows.map((v) => ({
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
      })),
      productosComprados,
    };
  },

  async guardarCliente(payload) {
    const supabase = createClient();
    const esNuevo = !payload.id;

    if (esNuevo) {
      const empresaId = await empresaActual(supabase);
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          empresa_id: empresaId,
          numero_documento: payload.documento.trim() || null,
          nombre: payload.nombre,
          telefono: payload.telefono,
          correo: payload.correo,
          direccion: payload.direccion,
          linea_credito: payload.lineaCredito,
          riesgo: payload.riesgo,
          estado: payload.activo ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria(supabase, {
        accion: `Cliente creado: ${payload.nombre}`,
        modulo: "clientes",
        tablaAfectada: "clientes",
        registroId: data.id,
      });
      return;
    }

    const { error } = await supabase
      .from("clientes")
      .update({
        numero_documento: payload.documento.trim() || null,
        nombre: payload.nombre,
        telefono: payload.telefono,
        correo: payload.correo,
        direccion: payload.direccion,
        linea_credito: payload.lineaCredito,
        riesgo: payload.riesgo,
      })
      .eq("id", payload.id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Cliente actualizado: ${payload.nombre}`,
      modulo: "clientes",
      tablaAfectada: "clientes",
      registroId: payload.id,
    });
  },

  async cambiarEstado(id, activo) {
    const supabase = createClient();
    const { error } = await supabase.from("clientes").update({ estado: activo }).eq("id", id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Cliente ${activo ? "activado" : "desactivado"}`,
      modulo: "clientes",
      tablaAfectada: "clientes",
      registroId: id,
    });
  },

  async eliminarCliente(id) {
    const supabase = createClient();
    // Borrado lógico: el cliente deja de listarse pero sus ventas y cotizaciones conservan el historial.
    const { data, error } = await supabase
      .from("clientes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("No se eliminó el cliente. Es posible que no tengas permiso para hacerlo.");
    }
    await registrarAuditoria(supabase, {
      accion: "Cliente eliminado",
      modulo: "clientes",
      tablaAfectada: "clientes",
      registroId: id,
    });
  },

  async enviarAvisoCatalogo(id) {
    // Sin proveedor de email/SMS real conectado (fuera de alcance de la arquitectura de
    // base de datos) — se deja registrado en auditoría como constancia de la acción,
    // igual que antes, pero ahora de verdad en public.audit_logs, no en memoria.
    const supabase = createClient();
    const { data: cliente, error } = await supabase.from("clientes").select("nombre").eq("id", id).single();
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Aviso de catálogo enviado a cliente inactivo: ${cliente.nombre}`,
      modulo: "clientes",
      tablaAfectada: "clientes",
      registroId: id,
    });
  },
};
