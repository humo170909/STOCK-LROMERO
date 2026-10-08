// Implementación (Supabase) de la interfaz ProductosService (ver services/productos.types.ts).
//
// Diferencia de forma importante: en el modelo de la app `Producto.stockActual` y
// `Producto.stockMinimo` viven aplanados en el mismo objeto porque el stock no
// estaba separado por sede. En la base de datos real el stock vive en una
// tabla `inventario` separada, una fila por (producto, sede) — ver
// supabase/migrations/08_inventario.sql y la sección 10 del requerimiento.
// Este servicio hace el join y "aplana" el resultado para que el tipo
// `Producto` que consume el resto de la app no tenga que cambiar.
import { getEstadoStock } from "@/types";
import type { Producto } from "@/types";
import type { AjusteStockPayload, GuardarProductoPayload } from "@/store/app-store";
import type { FiltrosProductos, ProductosService } from "../productos.types";
import { createClient } from "@/lib/supabase/client";
import { empresaActual, leerTodo, registrarAuditoria, sedeActual, textoParaFiltro } from "./_shared";

type ProductoInventarioRow = {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  especificacion_tecnica: string | null;
  marca: string | null;
  unidad_medida: string;
  precio_venta: number;
  estado: boolean;
  created_at: string;
  categorias: { nombre: string } | null;
  inventario: { stock_actual: number; stock_minimo: number; costo_actual: number; sede_id: string }[];
};

function aPlano(row: ProductoInventarioRow, sedeId: string): Producto {
  const inv = row.inventario.find((i) => i.sede_id === sedeId);
  return {
    id: row.id,
    sku: row.codigo,
    codigoBarras: row.codigo_barras ?? "",
    nombre: row.nombre,
    descripcion: row.descripcion ?? "",
    especificacionTecnica: row.especificacion_tecnica ?? undefined,
    categoria: row.categorias?.nombre ?? "",
    marca: row.marca ?? "",
    precioVenta: row.precio_venta,
    costo: inv?.costo_actual ?? 0,
    stockActual: inv?.stock_actual ?? 0,
    stockMinimo: inv?.stock_minimo ?? 0,
    unidad: row.unidad_medida,
    activo: row.estado,
    sedeId,
    creadoEn: row.created_at,
  };
}

export const productosService: ProductosService = {
  async listarProductos(filtros: FiltrosProductos = {}) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);

    let query = supabase
      .from("productos")
      .select(
        "id, codigo, codigo_barras, nombre, descripcion, especificacion_tecnica, marca, unidad_medida, precio_venta, estado, created_at, categorias(nombre), inventario(stock_actual, stock_minimo, costo_actual, sede_id)",
      )
      .is("deleted_at", null);

    if (filtros.busqueda?.trim()) {
      const texto = textoParaFiltro(filtros.busqueda);
      if (texto) query = query.or(`nombre.ilike.%${texto}%,codigo.ilike.%${texto}%,codigo_barras.ilike.%${texto}%`);
    }
    if (filtros.activo === "activos") query = query.eq("estado", true);
    if (filtros.activo === "inactivos") query = query.eq("estado", false);

    const ordenada = query.order("nombre").order("id");

    const data = await leerTodo((desde, hasta) => ordenada.range(desde, hasta));

    let productos = (data as unknown as ProductoInventarioRow[]).map((row) => aPlano(row, sedeId));

    // El filtro de categoría va en memoria: filtrar un embed sin !inner no filtra los productos.
    if (filtros.categoria && filtros.categoria !== "todas") {
      productos = productos.filter((p) => p.categoria === filtros.categoria);
    }

    // El filtro por estado de stock se aplica en memoria porque depende de la
    // combinación stock_actual/stock_minimo ya aplanada (lo mismo que hace
    // getEstadoStock en la maqueta).
    if (filtros.estadoStock) {
      productos = productos.filter((p) => getEstadoStock(p.stockActual, p.stockMinimo) === filtros.estadoStock);
    }

    return productos;
  },

  async listarCategorias() {
    const supabase = createClient();
    const { data, error } = await supabase.from("categorias").select("nombre").eq("estado", true).order("nombre");
    if (error) throw error;
    return data.map((c) => c.nombre);
  },

  async ajustarStock(payload: AjusteStockPayload) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const { error } = await supabase.rpc("fn_ajustar_stock", {
      p_producto_id: payload.productoId,
      p_sede_id: sedeId,
      p_tipo: payload.tipo,
      p_cantidad: payload.cantidad,
      p_motivo: payload.motivo,
      p_documento_sustento: payload.documentoSustento ?? null,
      p_observaciones: payload.observaciones ?? null,
    });
    if (error) throw error;
  },

  async guardarProducto(payload: GuardarProductoPayload) {
    const supabase = createClient();
    const sedeId = await sedeActual(supabase);
    const empresaId = await empresaActual(supabase);

    // La categoría se escribe a mano en el formulario: si no existe todavía, se crea.
    let categoriaId: string | null = null;
    const nombreCategoria = payload.categoria.trim();
    if (nombreCategoria) {
      const { data: existente, error: categoriaError } = await supabase
        .from("categorias")
        .select("id")
        .eq("nombre", nombreCategoria)
        .maybeSingle();
      if (categoriaError) throw categoriaError;
      if (existente) {
        categoriaId = existente.id;
      } else {
        const { data: nueva, error: nuevaError } = await supabase
          .from("categorias")
          .insert({ empresa_id: empresaId, nombre: nombreCategoria })
          .select("id")
          .single();
        if (nuevaError) throw nuevaError;
        categoriaId = nueva.id;
      }
    }

    const campos = {
      empresa_id: empresaId,
      codigo: payload.sku,
      codigo_barras: payload.codigoBarras.trim() || null,
      nombre: payload.nombre,
      descripcion: payload.descripcion.trim() || null,
      especificacion_tecnica: payload.especificacionTecnica ?? null,
      categoria_id: categoriaId,
      marca: payload.marca,
      unidad_medida: payload.unidad,
      precio_venta: payload.precioVenta,
      estado: payload.activo,
    };

    // id vacío = producto nuevo (la base genera el UUID); con id = edición.
    const { data: producto, error } = payload.id
      ? await supabase.from("productos").update(campos).eq("id", payload.id).select("id").single()
      : await supabase.from("productos").insert(campos).select("id").single();
    if (error) throw error;

    // El stock NO se escribe aquí (el cliente no puede escribir en `inventario`): esta función crea la fila
    // de la sede actual con stock 0 y guarda stock mínimo y costo. El stock entra por Compra o Ajuste.
    const { error: invError } = await supabase.rpc("fn_guardar_inventario_producto", {
      p_producto_id: producto.id,
      p_sede_id: sedeId,
      p_stock_minimo: payload.stockMinimo,
      p_costo: payload.costo,
    });
    if (invError) throw invError;

    await registrarAuditoria(supabase, {
      accion: `${payload.id ? "Producto actualizado" : "Producto creado"}: ${payload.nombre}`,
      modulo: "productos",
      tablaAfectada: "productos",
      registroId: producto.id,
    });
  },

  async cambiarEstado(id: string, activo: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("productos").update({ estado: activo }).eq("id", id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Producto ${activo ? "activado" : "desactivado"}`,
      modulo: "productos",
      tablaAfectada: "productos",
      registroId: id,
    });
  },

  async exportarKardex() {
    const supabase = createClient();
    const data = await leerTodo((desde, hasta) =>
      supabase
        .from("movimientos_inventario")
        .select("id, created_at, tipo, cantidad, stock_anterior, stock_nuevo, motivo, documento_sustento, observaciones, productos(nombre)")
        .order("created_at", { ascending: false })
        .order("id")
        .range(desde, hasta),
    );

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const hoja = workbook.addWorksheet("Kárdex");
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

    for (const m of data as unknown as Array<{
      created_at: string; tipo: string; cantidad: number; stock_anterior: number; stock_nuevo: number;
      motivo: string | null; documento_sustento: string | null; observaciones: string | null;
      productos: { nombre: string } | null;
    }>) {
      hoja.addRow({
        fecha: new Date(m.created_at).toLocaleString("es-PE"),
        producto: m.productos?.nombre ?? "",
        tipo: m.tipo,
        anterior: m.stock_anterior,
        modificada: m.cantidad,
        nueva: m.stock_nuevo,
        motivo: m.motivo ?? "",
        documento: m.documento_sustento ?? "",
        observaciones: m.observaciones ?? "",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },
};
