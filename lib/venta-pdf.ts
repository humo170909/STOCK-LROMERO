// PDF A4 vertical de una venta ya realizada (nota de venta). Solo lectura y solo navegador:
// jspdf se importa dinámicamente. No incluye costos ni ganancia.
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cargarLogo, dinero, LOGO_PDF } from "@/lib/cotizacion-pdf";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { montoEnLetras } from "@/lib/numero-a-letras";
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_VENTA_LABEL } from "@/types";
import type { DetalleVentaCompleto } from "@/services/ventas.types";
import type { ConfiguracionEmpresa } from "@/types";

export type VentaPdf = { blob: Blob; nombreArchivo: string };

type RGB = [number, number, number];
const NAVY: RGB = [15, 28, 51];
const SLATE: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const SOFT: RGB = [239, 246, 255];
const M = 18; // márgenes (mm)

export async function generarVentaPdf(datos: DetalleVentaCompleto, empresa: ConfiguracionEmpresa, nombreSede?: string): Promise<VentaPdf> {
  const { venta, detalle, cliente, nombreUsuario } = datos;
  if (detalle.length === 0) throw new Error("La venta no tiene productos.");

  const [{ jsPDF }, { autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), cargarLogo(LOGO_PDF)]);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - M * 2;
  let y = M;

  const texto = (valor: string, x: number, yy: number, o?: { bold?: boolean; size?: number; color?: RGB; align?: "left" | "right" | "center" }) => {
    doc.setFont("helvetica", o?.bold ? "bold" : "normal");
    doc.setFontSize(o?.size ?? 9);
    doc.setTextColor(...(o?.color ?? NAVY));
    doc.text(valor, x, yy, { align: o?.align ?? "left" });
  };
  const ultimoY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const asegurar = (necesario: number) => {
    if (y + necesario > alto - M - 6) {
      doc.addPage();
      y = M;
    }
  };

  // Encabezado: logo | empresa
  let x = M;
  if (logo) {
    const escala = Math.min(45 / logo.ancho, 20 / logo.alto);
    doc.addImage(logo.dataUrl, logo.formato, M, y, logo.ancho * escala, logo.alto * escala);
    x = M + logo.ancho * escala + 5;
  }
  texto(EMPRESA_DOCUMENTOS.nombre, x, y + 6, { bold: true, size: 14 });
  texto(`RUC N° ${EMPRESA_DOCUMENTOS.ruc}`, x, y + 11.5, { color: SLATE });
  const dir = doc.splitTextToSize(EMPRESA_DOCUMENTOS.direccion, ancho - M - x - 55) as string[];
  texto(dir.join("\n"), x, y + 16, { size: 8.5, color: SLATE });
  const contacto = [empresa.telefono && `Tel.: ${empresa.telefono}`, empresa.correo].filter(Boolean).join("  ·  ");
  if (contacto) texto(contacto, x, y + 16 + dir.length * 4 + 1, { size: 8.5, color: SLATE });

  // Caja con título y número
  const cajaX = ancho - M - 52;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.roundedRect(cajaX, y, 52, 22, 1.5, 1.5);
  texto("NOTA DE VENTA", cajaX + 26, y + 9, { bold: true, size: 12, align: "center" });
  texto(venta.numero, cajaX + 26, y + 16, { bold: true, size: 11, color: SLATE, align: "center" });
  y += 32;

  // Cliente / datos de la venta
  const fechaTxt = format(new Date(venta.fecha), "d 'de' MMMM 'de' yyyy", { locale: es });
  const horaTxt = format(new Date(venta.fecha), "HH:mm");
  const izquierda: Array<[string, string]> = [
    ["Cliente", cliente?.nombre ?? ""],
    ["Documento", cliente?.documento ?? ""],
    ["Dirección", cliente?.direccion ?? ""],
    ["Teléfono", cliente?.telefono ?? ""],
  ];
  const derecha: Array<[string, string]> = [
    ["Fecha", fechaTxt],
    ["Hora", horaTxt],
    ["Medio de pago", MEDIO_PAGO_VENTA_LABEL[venta.medioPago]],
    ...(datos.pagos.length > 1 ? datos.pagos.map((p): [string, string] => [`   · ${MEDIO_PAGO_LABEL[p.medioPago]}`, dinero(p.monto)]) : []),
    ["Vendedor", nombreUsuario],
    ["Sede", nombreSede ?? ""],
    ["Estado", venta.estado.charAt(0).toUpperCase() + venta.estado.slice(1)],
  ];
  const bloque = (titulo: string, filas: Array<[string, string]>, inicioX: number, anchoBloque: number) => {
    texto(titulo, inicioX, y, { bold: true, size: 9 });
    autoTable(doc, {
      startY: y + 1.5,
      body: filas.filter(([, v]) => v),
      theme: "plain",
      margin: { left: inicioX, right: ancho - inicioX - anchoBloque },
      tableWidth: anchoBloque,
      styles: { fontSize: 8.5, cellPadding: 1, textColor: NAVY },
      columnStyles: { 0: { fontStyle: "bold", textColor: SLATE, cellWidth: 26 } },
    });
    return ultimoY();
  };
  const mitad = util / 2 - 4;
  const yIzq = bloque("CLIENTE", izquierda, M, mitad);
  const yDer = bloque("DATOS DE LA VENTA", derecha, M + mitad + 8, mitad);
  y = Math.max(yIzq, yDer) + 7;

  // Productos (valores históricos de la venta)
  const hayDescuento = detalle.some((d) => d.descuento > 0);
  const cabecera = ["CANT.", "PRODUCTO", "P. UNIT.", ...(hayDescuento ? ["DSCTO."] : []), "TOTAL"];
  const cuerpo = detalle.map((d) => [
    String(d.cantidad),
    d.nombreProducto,
    dinero(d.precioHistorico),
    ...(hayDescuento ? [d.descuento > 0 ? dinero(d.descuento) : ""] : []),
    dinero(d.subtotal),
  ]);
  texto("DETALLE DE PRODUCTOS", M, y, { bold: true, size: 9 });
  const derechaCols: Record<number, { halign: "right" }> = {};
  for (let i = 2; i < cabecera.length; i++) derechaCols[i] = { halign: "right" };
  autoTable(doc, {
    startY: y + 2,
    head: [cabecera],
    body: cuerpo,
    margin: { left: M, right: M, top: M, bottom: M + 8 },
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: { fontSize: 8.5, cellPadding: 2, textColor: NAVY, lineColor: LINE, lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: { 0: { halign: "center", cellWidth: 16 }, ...derechaCols },
  });
  y = ultimoY() + 7;

  // Totales (valores guardados)
  const filas: Array<[string, string]> = [["Subtotal", dinero(venta.subtotal)]];
  if (venta.descuento > 0) filas.push(["Descuento", `- ${dinero(venta.descuento)}`]);
  if (venta.impuesto > 0) {
    const neto = venta.subtotal - venta.descuento;
    const tasa = neto > 0 ? venta.impuesto / neto : 0;
    filas.push([Math.abs(tasa - 0.18) < 0.005 ? "IGV (18%)" : "Impuesto", dinero(venta.impuesto)]);
  }
  asegurar(filas.length * 6 + 26);
  const xe = ancho - M - 75;
  for (const [e, v] of filas) {
    texto(e, xe, y, { color: SLATE });
    texto(v, ancho - M, y, { align: "right" });
    y += 6;
  }
  doc.setFillColor(...SOFT);
  doc.rect(xe - 3, y - 4, 78, 10, "F");
  texto("TOTAL", xe, y + 2.5, { bold: true });
  texto(dinero(venta.total), ancho - M - 1, y + 2.5, { bold: true, size: 11, align: "right" });
  y += 13;
  texto(`SON: ${montoEnLetras(venta.total)}`, M, y, { size: 8, color: SLATE });
  y += 8;

  // Observaciones (solo si existen)
  const obs = venta.observaciones?.trim();
  if (obs) {
    asegurar(14);
    texto("OBSERVACIONES", M, y, { bold: true });
    y += 5;
    for (const l of doc.splitTextToSize(obs, util) as string[]) {
      asegurar(5);
      texto(l, M, y, { size: 8.5 });
      y += 4.4;
    }
    y += 3;
  }

  asegurar(10);
  texto("Gracias por su preferencia", ancho / 2, y + 4, { size: 9, color: SLATE, align: "center" });

  // Pie en todas las páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, alto - 14, ancho - M, alto - 14);
    texto(`Nota de venta ${venta.numero}`, M, alto - 9, { size: 8, color: SLATE });
    texto(`Página ${p} de ${total}`, ancho - M, alto - 9, { size: 8, color: SLATE, align: "right" });
  }

  return { blob: doc.output("blob"), nombreArchivo: `NotaVenta-${venta.numero.replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf` };
}
