import "server-only";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Generación de backups (productos, ventas, detalle de ventas y ganancias) en Excel y/o CSV.
// Es la ÚNICA lógica de generación: la usa el backup manual (cliente autenticado, con RLS) y
// podrá usarla el automático (cliente de servicio) sin duplicar ningún cálculo de ganancias.
//
// Las ganancias NO se recalculan: se leen las columnas ya guardadas en cada venta
// (ventas.ganancia_total = total - impuesto - costo_total y venta_detalles.ganancia =
// precio*cantidad - descuento - costo_unitario*cantidad), que usan el costo HISTÓRICO de
// la venta (venta_detalles.costo_unitario), nunca el costo actual del producto.

type Supabase = SupabaseClient<Database>;
export type FormatoBackup = "xlsx" | "csv";

type Celda = string | number | null;
type Columna = { cabecera: string; clave: string; ancho: number; tipo: "texto" | "dinero" | "entero" };
type Tabla = { hoja: string; archivo: string; columnas: Columna[]; filas: Record<string, Celda>[]; ultimaFilaTotal?: boolean };

export type ResumenBackup = {
  productos: number;
  ventas: number;
  ventas_anuladas: number;
  total_vendido: number;
  costo_total: number;
  ganancia_bruta: number;
};

export type ArchivoBackup = { nombre: string; ruta: string; formato: FormatoBackup; tamano: number };

const ZONA = "America/Lima";
const TAM_PAGINA = 1000;

const redondear = (n: number) => Math.round(n * 100) / 100;

function fechaCorta(iso: string | Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA }).format(new Date(iso)); // YYYY-MM-DD
}

function fechaHora(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

async function leerTodo<T>(pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const todas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await pagina(desde, desde + TAM_PAGINA - 1);
    if (error) throw new Error(error.message);
    todas.push(...(data ?? []));
    if (!data || data.length < TAM_PAGINA) break;
  }
  return todas;
}

async function reunirDatos(supabase: Supabase, empresaId: string) {
  const [empresa, categorias, sedes, clientes, perfiles, productos, inventario, ventas, pagos, detalles] = await Promise.all([
    supabase.from("empresas").select("nombre").eq("id", empresaId).single().then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data;
    }),
    leerTodo((d, h) => supabase.from("categorias").select("id, nombre").eq("empresa_id", empresaId).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("sedes").select("id, nombre").eq("empresa_id", empresaId).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("clientes").select("id, nombre, numero_documento").eq("empresa_id", empresaId).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("profiles").select("id, nombre").eq("empresa_id", empresaId).order("id").range(d, h)),
    leerTodo((d, h) => supabase.from("productos").select("*").eq("empresa_id", empresaId).order("id").range(d, h)),
    leerTodo((d, h) =>
      supabase.from("inventario").select("*, productos!inner(empresa_id)").eq("productos.empresa_id", empresaId).order("id").range(d, h),
    ),
    leerTodo((d, h) => supabase.from("ventas").select("*").eq("empresa_id", empresaId).order("correlativo").order("id").range(d, h)),
    leerTodo((d, h) =>
      supabase.from("venta_pagos").select("*, ventas!inner(empresa_id)").eq("ventas.empresa_id", empresaId).order("id").range(d, h),
    ),
    leerTodo((d, h) =>
      supabase
        .from("venta_detalles")
        .select("*, ventas!inner(empresa_id, numero, fecha, estado)")
        .eq("ventas.empresa_id", empresaId)
        .order("id")
        .range(d, h),
    ),
  ]);
  return { empresa, categorias, sedes, clientes, perfiles, productos, inventario, ventas, pagos, detalles };
}

export async function construirTablas(supabase: Supabase, empresaId: string) {
  const d = await reunirDatos(supabase, empresaId);

  const nombreCategoria = new Map(d.categorias.map((c) => [c.id, c.nombre]));
  const nombreSede = new Map(d.sedes.map((s) => [s.id, s.nombre]));
  const cliente = new Map(d.clientes.map((c) => [c.id, c]));
  const nombreUsuario = new Map(d.perfiles.map((p) => [p.id, p.nombre]));
  const nombreProducto = new Map(d.productos.map((p) => [p.id, p]));
  const inventarioPorProducto = new Map<string, typeof d.inventario>();
  for (const i of d.inventario) {
    const lista = inventarioPorProducto.get(i.producto_id) ?? [];
    lista.push(i);
    inventarioPorProducto.set(i.producto_id, lista);
  }
  const pagosPorVenta = new Map<string, string[]>();
  for (const p of d.pagos) {
    const lista = pagosPorVenta.get(p.venta_id) ?? [];
    lista.push(`${p.medio_pago} ${p.monto.toFixed(2)}`);
    pagosPorVenta.set(p.venta_id, lista);
  }
  const ventaPorId = new Map(d.ventas.map((v) => [v.id, v]));

  // ---- Productos: una fila por producto y sede (el stock es por sede) ----
  const filasProductos: Record<string, Celda>[] = [];
  for (const p of d.productos) {
    const base = {
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      categoria: p.categoria_id ? (nombreCategoria.get(p.categoria_id) ?? "") : "",
      precio_venta: p.precio_venta,
      costo_catalogo: p.costo_actual,
      estado: p.deleted_at ? "Eliminado" : p.estado ? "Activo" : "Inactivo",
      creado: fechaHora(p.created_at),
      actualizado: fechaHora(p.updated_at),
    };
    const filasInv = inventarioPorProducto.get(p.id) ?? [];
    if (filasInv.length === 0) {
      filasProductos.push({ ...base, sede: "", stock: 0, stock_minimo: p.stock_minimo_default, costo_sede: null });
    }
    for (const i of filasInv) {
      filasProductos.push({
        ...base,
        sede: nombreSede.get(i.sede_id) ?? "",
        stock: i.stock_actual,
        stock_minimo: i.stock_minimo,
        costo_sede: i.costo_actual,
      });
    }
  }
  const productos: Tabla = {
    hoja: "Productos",
    archivo: "productos",
    columnas: [
      { cabecera: "ID", clave: "id", ancho: 38, tipo: "texto" },
      { cabecera: "Código / SKU", clave: "codigo", ancho: 16, tipo: "texto" },
      { cabecera: "Nombre", clave: "nombre", ancho: 34, tipo: "texto" },
      { cabecera: "Descripción", clave: "descripcion", ancho: 36, tipo: "texto" },
      { cabecera: "Categoría", clave: "categoria", ancho: 20, tipo: "texto" },
      { cabecera: "Precio de venta", clave: "precio_venta", ancho: 15, tipo: "dinero" },
      { cabecera: "Costo actual (catálogo)", clave: "costo_catalogo", ancho: 22, tipo: "dinero" },
      { cabecera: "Sede", clave: "sede", ancho: 18, tipo: "texto" },
      { cabecera: "Stock", clave: "stock", ancho: 10, tipo: "entero" },
      { cabecera: "Stock mínimo", clave: "stock_minimo", ancho: 13, tipo: "entero" },
      { cabecera: "Costo en la sede", clave: "costo_sede", ancho: 16, tipo: "dinero" },
      { cabecera: "Estado", clave: "estado", ancho: 12, tipo: "texto" },
      { cabecera: "Creado", clave: "creado", ancho: 17, tipo: "texto" },
      { cabecera: "Actualizado", clave: "actualizado", ancho: 17, tipo: "texto" },
    ],
    filas: filasProductos,
  };

  // ---- Ventas ----
  const ventas: Tabla = {
    hoja: "Ventas",
    archivo: "ventas",
    columnas: [
      { cabecera: "ID", clave: "id", ancho: 38, tipo: "texto" },
      { cabecera: "Número de venta", clave: "numero", ancho: 16, tipo: "texto" },
      { cabecera: "Fecha", clave: "fecha", ancho: 17, tipo: "texto" },
      { cabecera: "Cliente", clave: "cliente", ancho: 28, tipo: "texto" },
      { cabecera: "Documento cliente", clave: "documento", ancho: 18, tipo: "texto" },
      { cabecera: "Usuario", clave: "usuario", ancho: 24, tipo: "texto" },
      { cabecera: "Sede", clave: "sede", ancho: 18, tipo: "texto" },
      { cabecera: "Subtotal", clave: "subtotal", ancho: 13, tipo: "dinero" },
      { cabecera: "Descuento", clave: "descuento", ancho: 12, tipo: "dinero" },
      { cabecera: "Impuesto", clave: "impuesto", ancho: 12, tipo: "dinero" },
      { cabecera: "Total", clave: "total", ancho: 13, tipo: "dinero" },
      { cabecera: "Método de pago", clave: "medio_pago", ancho: 16, tipo: "texto" },
      { cabecera: "Detalle de pagos", clave: "pagos", ancho: 30, tipo: "texto" },
      { cabecera: "Estado", clave: "estado", ancho: 13, tipo: "texto" },
    ],
    filas: d.ventas.map((v) => ({
      id: v.id,
      numero: v.numero,
      fecha: fechaHora(v.fecha),
      cliente: cliente.get(v.cliente_id)?.nombre ?? "",
      documento: cliente.get(v.cliente_id)?.numero_documento ?? "",
      usuario: nombreUsuario.get(v.usuario_id) ?? "",
      sede: nombreSede.get(v.sede_id) ?? "",
      subtotal: v.subtotal,
      descuento: v.descuento,
      impuesto: v.impuesto,
      total: v.total,
      medio_pago: v.medio_pago,
      pagos: (pagosPorVenta.get(v.id) ?? []).join(" + "),
      estado: v.estado,
    })),
  };

  // ---- Detalle de ventas (costo HISTÓRICO guardado en la línea) ----
  const detalleVentas: Tabla = {
    hoja: "Detalle Ventas",
    archivo: "detalle-ventas",
    columnas: [
      { cabecera: "ID venta", clave: "venta_id", ancho: 38, tipo: "texto" },
      { cabecera: "Número de venta", clave: "numero", ancho: 16, tipo: "texto" },
      { cabecera: "Fecha", clave: "fecha", ancho: 17, tipo: "texto" },
      { cabecera: "Estado venta", clave: "estado", ancho: 13, tipo: "texto" },
      { cabecera: "Código producto", clave: "codigo", ancho: 16, tipo: "texto" },
      { cabecera: "Producto", clave: "producto", ancho: 34, tipo: "texto" },
      { cabecera: "Cantidad", clave: "cantidad", ancho: 10, tipo: "entero" },
      { cabecera: "Precio unitario", clave: "precio", ancho: 14, tipo: "dinero" },
      { cabecera: "Costo histórico unitario", clave: "costo", ancho: 22, tipo: "dinero" },
      { cabecera: "Descuento", clave: "descuento", ancho: 12, tipo: "dinero" },
      { cabecera: "Subtotal", clave: "subtotal", ancho: 13, tipo: "dinero" },
      { cabecera: "Costo total", clave: "costo_total", ancho: 13, tipo: "dinero" },
      { cabecera: "Ganancia", clave: "ganancia", ancho: 13, tipo: "dinero" },
    ],
    filas: d.detalles
      .slice()
      .sort((a, b) => a.ventas.numero.localeCompare(b.ventas.numero) || a.created_at.localeCompare(b.created_at))
      .map((l) => ({
        venta_id: l.venta_id,
        numero: l.ventas.numero,
        fecha: fechaHora(l.ventas.fecha),
        estado: l.ventas.estado,
        codigo: nombreProducto.get(l.producto_id)?.codigo ?? "",
        producto: nombreProducto.get(l.producto_id)?.nombre ?? "",
        cantidad: l.cantidad,
        precio: l.precio_unitario,
        costo: l.costo_unitario,
        descuento: l.descuento,
        subtotal: l.subtotal,
        costo_total: l.costo_total,
        ganancia: l.ganancia,
      })),
  };

  // ---- Ganancias: solo ventas confirmadas (una venta anulada no genera ganancia) ----
  const confirmadas = d.ventas.filter((v) => v.estado === "confirmada");
  const totalVendido = redondear(confirmadas.reduce((s, v) => s + v.total, 0));
  const totalImpuesto = redondear(confirmadas.reduce((s, v) => s + v.impuesto, 0));
  const totalCosto = redondear(confirmadas.reduce((s, v) => s + v.costo_total, 0));
  const totalGanancia = redondear(confirmadas.reduce((s, v) => s + v.ganancia_total, 0));
  const ganancias: Tabla = {
    hoja: "Ganancias",
    archivo: "ganancias",
    ultimaFilaTotal: true,
    columnas: [
      { cabecera: "Fecha", clave: "fecha", ancho: 17, tipo: "texto" },
      { cabecera: "Venta", clave: "numero", ancho: 16, tipo: "texto" },
      { cabecera: "Sede", clave: "sede", ancho: 18, tipo: "texto" },
      { cabecera: "Total vendido", clave: "total", ancho: 15, tipo: "dinero" },
      { cabecera: "Impuesto", clave: "impuesto", ancho: 12, tipo: "dinero" },
      { cabecera: "Costo de productos vendidos", clave: "costo", ancho: 27, tipo: "dinero" },
      { cabecera: "Ganancia bruta", clave: "ganancia", ancho: 16, tipo: "dinero" },
    ],
    filas: [
      ...confirmadas.map((v) => ({
        fecha: fechaHora(v.fecha),
        numero: v.numero,
        sede: nombreSede.get(v.sede_id) ?? "",
        total: v.total,
        impuesto: v.impuesto,
        costo: v.costo_total,
        ganancia: v.ganancia_total,
      })),
      { fecha: "TOTAL", numero: "", sede: "", total: totalVendido, impuesto: totalImpuesto, costo: totalCosto, ganancia: totalGanancia },
    ],
  };

  const resumen: ResumenBackup = {
    productos: d.productos.length,
    ventas: confirmadas.length,
    ventas_anuladas: ventaPorId.size - confirmadas.length,
    total_vendido: totalVendido,
    costo_total: totalCosto,
    ganancia_bruta: totalGanancia,
  };

  return { empresa: d.empresa.nombre, tablas: [productos, ventas, detalleVentas, ganancias], resumen };
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
async function construirExcel(empresa: string, tablas: Tabla[], resumen: ResumenBackup, ahora: Date) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Sistema de inventario";
  libro.created = ahora;

  const hojaResumen = libro.addWorksheet("Resumen");
  hojaResumen.columns = [{ width: 32 }, { width: 28 }];
  const titulo = hojaResumen.addRow(["Backup de información"]);
  titulo.font = { bold: true, size: 14, color: { argb: "FF0F2742" } };
  hojaResumen.addRow([]);
  const lineas: [string, string | number, boolean?][] = [
    ["Fecha del backup", fechaHora(ahora.toISOString())],
    ["Empresa", empresa],
    ["Total de productos", resumen.productos],
    ["Total de ventas (confirmadas)", resumen.ventas],
    ["Ventas anuladas (no suman)", resumen.ventas_anuladas],
    ["Total vendido", resumen.total_vendido, true],
    ["Costo total", resumen.costo_total, true],
    ["Ganancia bruta", resumen.ganancia_bruta, true],
  ];
  for (const [etiqueta, valor, dinero] of lineas) {
    const fila = hojaResumen.addRow([etiqueta, valor]);
    fila.getCell(1).font = { bold: true };
    fila.getCell(2).alignment = { horizontal: "left" };
    if (dinero) fila.getCell(2).numFmt = '"S/" #,##0.00';
  }

  for (const t of tablas) {
    const hoja = libro.addWorksheet(t.hoja, { views: [{ state: "frozen", ySplit: 1 }] });
    hoja.columns = t.columnas.map((c) => ({ header: c.cabecera, key: c.clave, width: c.ancho }));
    const cabecera = hoja.getRow(1);
    cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cabecera.alignment = { vertical: "middle" };
    cabecera.height = 22;
    cabecera.eachCell((celda) => {
      celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2742" } };
    });
    for (const fila of t.filas) hoja.addRow(fila);
    t.columnas.forEach((c, i) => {
      if (c.tipo === "dinero") hoja.getColumn(i + 1).numFmt = "#,##0.00";
      if (c.tipo === "entero") hoja.getColumn(i + 1).numFmt = "0";
    });
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.columnas.length } };
    if (t.ultimaFilaTotal) hoja.getRow(hoja.rowCount).font = { bold: true };
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// CSV (UTF-8 con BOM para que Excel respete tildes)
// ---------------------------------------------------------------------------
function celdaCsv(valor: Celda, tipo: Columna["tipo"]) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return tipo === "dinero" ? valor.toFixed(2) : String(valor);
  // Evita que Excel interprete un texto como fórmula (CSV injection).
  const texto = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function construirCsv(t: Tabla) {
  const filas = [
    t.columnas.map((c) => celdaCsv(c.cabecera, "texto")).join(","),
    ...t.filas.map((f) => t.columnas.map((c) => celdaCsv(f[c.clave] ?? null, c.tipo)).join(",")),
  ];
  return "﻿" + filas.join("\r\n") + "\r\n";
}

async function construirZipCsv(tablas: Tabla[], dia: string) {
  const zip = new JSZip();
  for (const t of tablas) zip.file(`${t.archivo}-${dia}.csv`, construirCsv(t));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ---------------------------------------------------------------------------
// Ejecución completa: registro en historial + generación + subida a Storage privado
// ---------------------------------------------------------------------------
export async function ejecutarBackup(params: {
  supabase: Supabase;
  empresaId: string;
  tipo: "manual" | "automatico";
  formatos: FormatoBackup[];
  usuarioId: string | null;
}) {
  const { supabase, empresaId, tipo, formatos, usuarioId } = params;

  const { data: registro, error: errorRegistro } = await supabase
    .from("backups")
    .insert({ empresa_id: empresaId, tipo, formatos, creado_por: usuarioId })
    .select("id")
    .single();
  if (errorRegistro) throw new Error(errorRegistro.message);

  try {
    const ahora = new Date();
    const dia = fechaCorta(ahora);
    const { empresa, tablas, resumen } = await construirTablas(supabase, empresaId);

    const archivos: { nombre: string; formato: FormatoBackup; contenido: Buffer; tipoMime: string }[] = [];
    if (formatos.includes("xlsx")) {
      archivos.push({
        nombre: `Backup-LRGrupo-${dia}.xlsx`,
        formato: "xlsx",
        contenido: await construirExcel(empresa, tablas, resumen, ahora),
        tipoMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
    if (formatos.includes("csv")) {
      archivos.push({
        nombre: `Backup-LRGrupo-CSV-${dia}.zip`,
        formato: "csv",
        contenido: await construirZipCsv(tablas, dia),
        tipoMime: "application/zip",
      });
    }

    const guardados: ArchivoBackup[] = [];
    for (const a of archivos) {
      const ruta = `${empresaId}/${registro.id}/${a.nombre}`;
      const { error } = await supabase.storage.from("backups").upload(ruta, a.contenido, { contentType: a.tipoMime, upsert: false });
      if (error) throw new Error(error.message);
      guardados.push({ nombre: a.nombre, ruta, formato: a.formato, tamano: a.contenido.length });
    }

    const { error: errorFinal } = await supabase
      .from("backups")
      .update({
        estado: "completado",
        archivos: guardados,
        tamano_bytes: guardados.reduce((s, a) => s + a.tamano, 0),
        resumen,
        completed_at: new Date().toISOString(),
      })
      .eq("id", registro.id);
    if (errorFinal) throw new Error(errorFinal.message);

    return { id: registro.id, archivos: guardados, resumen };
  } catch (error) {
    // El detalle técnico se guarda en el historial; al usuario solo se le muestra un mensaje general.
    await supabase
      .from("backups")
      .update({ estado: "error", error_mensaje: error instanceof Error ? error.message : String(error), completed_at: new Date().toISOString() })
      .eq("id", registro.id);
    throw error;
  }
}
