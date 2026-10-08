// Implementa ProveedoresService contra public.proveedores +
// public.compras (para los totales de compra).
import { createClient } from "@/lib/supabase/client";
import { empresaActual, enLotes, leerTodo, registrarAuditoria, textoParaFiltro } from "./_shared";
import type { ProveedoresService } from "../proveedores.types";
import type { CompraListado } from "../compras.types";
import type { Proveedor } from "@/types";
import type { Database } from "@/types/database.types";

function proveedorDesdeFila(row: Database["public"]["Tables"]["proveedores"]["Row"]): Proveedor {
  return {
    id: row.id,
    razonSocial: row.razon_social,
    documento: row.documento ?? "",
    telefono: row.telefono ?? "",
    correo: row.correo ?? "",
    direccion: row.direccion ?? "",
    contacto: row.contacto ?? "",
    activo: row.estado,
    observaciones: row.observaciones ?? undefined,
  };
}

function compraDesdeFila(row: Database["public"]["Tables"]["compras"]["Row"], nombreProveedor: string): CompraListado {
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
    nombreProveedor,
  };
}

export const proveedoresService: ProveedoresService = {
  async listarProveedores(filtros = {}) {
    const supabase = createClient();
    let query = supabase.from("proveedores").select("*").is("deleted_at", null);

    if (filtros.activo === "activos") query = query.eq("estado", true);
    if (filtros.activo === "inactivos") query = query.eq("estado", false);
    if (filtros.busqueda?.trim()) {
      const texto = textoParaFiltro(filtros.busqueda);
      if (texto) query = query.or(`razon_social.ilike.%${texto}%,documento.ilike.%${texto}%`);
    }

    const ordenada = query.order("razon_social").order("id");

    const rows = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const comprasRows = await enLotes(ids, (lote) =>
      leerTodo((desde, hasta) =>
        supabase
          .from("compras")
          .select("id, proveedor_id, total, fecha")
          .eq("estado", "registrada")
          .in("proveedor_id", lote)
          .order("id")
          .range(desde, hasta),
      ),
    );

    const porProveedor = new Map<string, { total: number; count: number; ultima: string | null }>();
    for (const c of comprasRows) {
      const actual = porProveedor.get(c.proveedor_id) ?? { total: 0, count: 0, ultima: null as string | null };
      actual.total += c.total;
      actual.count += 1;
      if (!actual.ultima || new Date(c.fecha) > new Date(actual.ultima)) actual.ultima = c.fecha;
      porProveedor.set(c.proveedor_id, actual);
    }

    return rows.map((row) => {
      const resumen = porProveedor.get(row.id) ?? { total: 0, count: 0, ultima: null };
      return {
        ...proveedorDesdeFila(row),
        totalComprado: resumen.total,
        numeroCompras: resumen.count,
        ultimaCompra: resumen.ultima,
      };
    });
  },

  async obtenerHistorialCompras(proveedorId) {
    const supabase = createClient();
    const { data: proveedor, error: proveedorError } = await supabase
      .from("proveedores")
      .select("razon_social")
      .eq("id", proveedorId)
      .single();
    if (proveedorError) throw proveedorError;

    const { data: compras, error } = await supabase
      .from("compras")
      .select("*")
      .eq("proveedor_id", proveedorId)
      .order("fecha", { ascending: false });
    if (error) throw error;

    return compras.map((c) => compraDesdeFila(c, proveedor.razon_social));
  },

  async guardarProveedor(payload) {
    const supabase = createClient();
    const esNuevo = !payload.id;

    if (esNuevo) {
      const empresaId = await empresaActual(supabase);
      const { data, error } = await supabase
        .from("proveedores")
        .insert({
          empresa_id: empresaId,
          razon_social: payload.razonSocial,
          documento: payload.documento.trim() || null,
          telefono: payload.telefono,
          correo: payload.correo,
          direccion: payload.direccion,
          contacto: payload.contacto,
          observaciones: payload.observaciones ?? null,
          estado: payload.activo ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;
      await registrarAuditoria(supabase, {
        accion: `Proveedor creado: ${payload.razonSocial}`,
        modulo: "proveedores",
        tablaAfectada: "proveedores",
        registroId: data.id,
      });
      return;
    }

    const { error } = await supabase
      .from("proveedores")
      .update({
        razon_social: payload.razonSocial,
        documento: payload.documento.trim() || null,
        telefono: payload.telefono,
        correo: payload.correo,
        direccion: payload.direccion,
        contacto: payload.contacto,
        observaciones: payload.observaciones ?? null,
      })
      .eq("id", payload.id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Proveedor actualizado: ${payload.razonSocial}`,
      modulo: "proveedores",
      tablaAfectada: "proveedores",
      registroId: payload.id,
    });
  },

  async cambiarEstado(id, activo) {
    const supabase = createClient();
    const { error } = await supabase.from("proveedores").update({ estado: activo }).eq("id", id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Proveedor ${activo ? "activado" : "desactivado"}`,
      modulo: "proveedores",
      tablaAfectada: "proveedores",
      registroId: id,
    });
  },
};
