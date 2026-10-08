// Genera el PDF de una cotización comercial (NO es boleta, factura ni comprobante SUNAT).
// Solo se ejecuta en el navegador: jspdf se importa dinámicamente dentro de la función para
// no cargarlo durante el render en servidor.
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { montoEnLetras } from "@/lib/numero-a-letras";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import type { DatosCotizacionPdf } from "@/services/cotizaciones.types";
import type { ConfiguracionEmpresa } from "@/types";

export type CotizacionPdf = { blob: Blob; nombreArchivo: string };

type RGB = [number, number, number];
const NAVY: RGB = [15, 28, 51];
const SLATE: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const SOFT: RGB = [239, 246, 255];

const MARGEN = 14;
export const LOGO_PDF = "/logogrupo.jpeg";
const CUENTA_PDF = "/cuenta.jpeg";

export const dinero = (n: number) => `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaLarga = (iso: string) => format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: es });

type Logo = { dataUrl: string; formato: "PNG" | "JPEG"; ancho: number; alto: number };

/** Carga el logo; si falla por cualquier motivo devuelve null y el PDF sigue sin logo. */
export async function cargarLogo(url: string): Promise<Logo | null> {
  if (!url) return null;
  try {
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    const blob = await respuesta.blob();
    const formato = blob.type === "image/jpeg" ? "JPEG" : blob.type === "image/png" ? "PNG" : null;
    if (!formato) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result));
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(blob);
    });
    const dimensiones = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error("logo"));
      img.src = dataUrl;
    });
    if (!dimensiones.w || !dimensiones.h) return null;
    return { dataUrl, formato, ancho: dimensiones.w, alto: dimensiones.h };
  } catch {
    return null;
  }
}

function nombreArchivoSeguro(numero: string) {
  return `Cotizacion-${numero.replace(/[^a-zA-Z0-9_-]+/g, "-")}.pdf`;
}

export async function generarCotizacionPdf(datos: DatosCotizacionPdf, empresa: ConfiguracionEmpresa): Promise<CotizacionPdf> {
  const { cotizacion, cliente, lineas } = datos;
  if (lineas.length === 0) throw new Error("La cotización no tiene productos.");

  const [{ jsPDF }, { autoTable }, logo, cuenta] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    cargarLogo(LOGO_PDF),
    cargarLogo(CUENTA_PDF),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const util = ancho - MARGEN * 2;
  let y = MARGEN;

  const texto = (valor: string, x: number, yy: number, opciones?: { bold?: boolean; size?: number; color?: RGB; align?: "left" | "right" | "center" }) => {
    doc.setFont("helvetica", opciones?.bold ? "bold" : "normal");
    doc.setFontSize(opciones?.size ?? 9);
    doc.setTextColor(...(opciones?.color ?? NAVY));
    doc.text(valor, x, yy, { align: opciones?.align ?? "left" });
  };
  const asegurarEspacio = (necesario: number) => {
    if (y + necesario > alto - 20) {
      doc.addPage();
      y = MARGEN;
    }
  };

  // ── Encabezado: logo + empresa | COTIZACIÓN ──
  let xTexto = MARGEN;
  if (logo) {
    const escala = Math.min(40 / logo.ancho, 18 / logo.alto);
    const anchoLogo = logo.ancho * escala;
    doc.addImage(logo.dataUrl, logo.formato, MARGEN, y, anchoLogo, logo.alto * escala);
    xTexto = MARGEN + anchoLogo + 4;
  }
  texto(EMPRESA_DOCUMENTOS.nombre, xTexto, y + 6, { bold: true, size: 14 });
  texto(`RUC N° ${EMPRESA_DOCUMENTOS.ruc}`, xTexto, y + 11.5, { size: 9, color: SLATE });
  const dirPartes = doc.splitTextToSize(EMPRESA_DOCUMENTOS.direccion, ancho - MARGEN * 2 - 60 - (xTexto - MARGEN)) as string[];
  texto(dirPartes.join("\n"), xTexto, y + 16, { size: 8.5, color: SLATE });

  texto("COTIZACIÓN", ancho - MARGEN, y + 6, { bold: true, size: 16, align: "right" });
  texto(cotizacion.numero, ancho - MARGEN, y + 12, { bold: true, size: 10, color: SLATE, align: "right" });
  y += 24;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(MARGEN, y, ancho - MARGEN, y);
  y += 7;

  // ── Fecha / Señores / Referencia ──
  const filaDato = (etiqueta: string, valor: string) => {
    texto(etiqueta, MARGEN, y, { bold: true, size: 9, color: SLATE });
    const partes = doc.splitTextToSize(valor, util - 32) as string[];
    texto(partes.join("\n"), MARGEN + 32, y, { size: 9 });
    y += Math.max(1, partes.length) * 4.6;
  };
  filaDato("FECHA:", fechaLarga(cotizacion.fechaEmision));
  filaDato("SEÑORES:", cliente?.nombre || "—");
  if (cliente?.documento) filaDato("RUC / DOC.:", cliente.documento);
  if (cliente?.direccion) filaDato("DIRECCIÓN:", cliente.direccion);
  if (cliente?.telefono) filaDato("TELÉFONO:", cliente.telefono);
  if (cliente?.correo) filaDato("E-MAIL:", cliente.correo);
  filaDato("REFERENCIA:", `COTIZACIÓN - ${cotizacion.numero}`);
  filaDato("VÁLIDA HASTA:", fechaLarga(cotizacion.fechaVencimiento));
  y += 3;

  // ── Datos de la empresa ──
  const datosEmpresa: Array<[string, string]> = [
    ["RUC", EMPRESA_DOCUMENTOS.ruc],
    ["TELÉFONO", empresa.telefono],
    ["E-MAIL", empresa.correo],
    ["DIRECCIÓN", EMPRESA_DOCUMENTOS.direccion],
  ].filter((par): par is [string, string] => !!par[1]);
  if (datosEmpresa.length > 0) {
    texto("DATOS DE LA EMPRESA", MARGEN, y, { bold: true, size: 9 });
    y += 2;
    autoTable(doc, {
      startY: y,
      body: datosEmpresa,
      theme: "plain",
      margin: { left: MARGEN, right: MARGEN },
      styles: { fontSize: 8.5, cellPadding: 1.2, textColor: NAVY },
      columnStyles: { 0: { fontStyle: "bold", textColor: SLATE, cellWidth: 32 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // ── Detalle ──
  const hayDescuento = lineas.some((l) => l.descuento > 0);
  const hayMarca = lineas.some((l) => l.marca);
  const hayUnidad = lineas.some((l) => l.unidadMedida);

  const cabecera = ["ÍTEM", "DESCRIPCIÓN"];
  if (hayUnidad) cabecera.push("UNIDAD");
  cabecera.push("CANT.");
  if (hayMarca) cabecera.push("MARCA");
  cabecera.push("P. UNIT.");
  if (hayDescuento) cabecera.push("DSCTO.");
  cabecera.push("P. TOTAL");

  const cuerpo = lineas.map((l, i) => {
    const fila: string[] = [String(i + 1), l.descripcion ? `${l.nombreProducto}\n${l.descripcion}` : l.nombreProducto];
    if (hayUnidad) fila.push(l.unidadMedida);
    fila.push(String(l.cantidad));
    if (hayMarca) fila.push(l.marca ?? "");
    fila.push(dinero(l.precio));
    if (hayDescuento) fila.push(l.descuento > 0 ? dinero(l.descuento) : "");
    fila.push(dinero(l.subtotal));
    return fila;
  });

  const idxDerecha = cabecera.map((c, i) => (["CANT.", "P. UNIT.", "DSCTO.", "P. TOTAL"].includes(c) ? i : -1)).filter((i) => i >= 0);
  const estilosColumna: Record<number, { halign: "right" | "center" }> = {};
  idxDerecha.forEach((i) => (estilosColumna[i] = { halign: "right" }));
  estilosColumna[0] = { halign: "center" };

  texto("DETALLE DE COTIZACIÓN", MARGEN, y, { bold: true, size: 9 });
  y += 2;
  autoTable(doc, {
    startY: y,
    head: [cabecera],
    body: cuerpo,
    margin: { left: MARGEN, right: MARGEN, bottom: 22 },
    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: { fontSize: 8.5, cellPadding: 2, textColor: NAVY, lineColor: LINE, lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: { ...estilosColumna, 0: { halign: "center", cellWidth: 12 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // ── Totales ──
  const neto = cotizacion.subtotal - cotizacion.descuento;
  const tasa = neto > 0 ? cotizacion.impuesto / neto : 0;
  const etiquetaImpuesto =
    cotizacion.impuesto > 0 ? (Math.abs(tasa - 0.18) < 0.005 ? "IGV (18%)" : `Impuesto (${Math.round(tasa * 10000) / 100}%)`) : "";
  const filasTotales: Array<[string, string]> = [["Subtotal", dinero(cotizacion.subtotal)]];
  if (cotizacion.descuento > 0) filasTotales.push(["Descuento", `- ${dinero(cotizacion.descuento)}`]);
  if (cotizacion.impuesto > 0) filasTotales.push([etiquetaImpuesto, dinero(cotizacion.impuesto)]);
  if ((cotizacion.movilidad ?? 0) > 0) filasTotales.push(["Movilidad", dinero(cotizacion.movilidad ?? 0)]);

  // Franja: imagen de cuenta (izquierda) + cuadro de resumen enmarcado (derecha).
  const lado = cuenta ? 62 : 0;
  const altoCuadro = Math.max(lado, 52, filasTotales.length > 3 ? 70 : 0);
  asegurarEspacio(altoCuadro + 14);
  const yFranja = y;
  if (cuenta) {
    const escala = Math.min(lado / cuenta.ancho, lado / cuenta.alto);
    const w = cuenta.ancho * escala;
    const h = cuenta.alto * escala;
    doc.addImage(cuenta.dataUrl, cuenta.formato, MARGEN, yFranja, w, h);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(MARGEN, yFranja, w, h);
  }
  const bx = cuenta ? MARGEN + lado + 6 : MARGEN;
  const bw = ancho - MARGEN - bx;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.rect(bx, yFranja, bw, altoCuadro);
  doc.setFillColor(...NAVY);
  doc.rect(bx, yFranja, bw, 8, "F");
  texto("RESUMEN DE LA COTIZACIÓN", bx + bw / 2, yFranja + 5.4, { bold: true, size: 9, color: [255, 255, 255], align: "center" });
  let yf = yFranja + 15;
  for (const [etiqueta, valor] of filasTotales) {
    texto(etiqueta.toUpperCase(), bx + 5, yf, { bold: true, size: 9, color: SLATE });
    texto(valor, bx + bw - 5, yf, { bold: true, size: 10, align: "right" });
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(bx + 5, yf + 2.5, bx + bw - 5, yf + 2.5);
    yf += 8;
  }
  const yTotal = yFranja + altoCuadro - 27;
  doc.setFillColor(...SOFT);
  doc.rect(bx + 0.25, yTotal, bw - 0.5, 13, "F");
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(bx, yTotal, bx + bw, yTotal);
  doc.line(bx, yTotal + 13, bx + bw, yTotal + 13);
  texto(cotizacion.impuesto > 0 ? "TOTAL INCLUIDO IMPUESTO" : "TOTAL", bx + 5, yTotal + 8.3, { bold: true, size: 10 });
  texto(dinero(cotizacion.total), bx + bw - 5, yTotal + 8.5, { bold: true, size: 13, align: "right" });
  const son = doc.splitTextToSize(`SON: ${montoEnLetras(cotizacion.total)}`, bw - 10) as string[];
  son.slice(0, 2).forEach((l, i) => texto(l, bx + 5, yTotal + 18.5 + i * 3.8, { bold: true, size: 7.5, color: SLATE }));
  y = yFranja + altoCuadro + 7;

  // ── Condiciones (solo si existen), enmarcadas ──
  const condiciones = cotizacion.condiciones?.trim();
  if (condiciones) {
    const partes = doc.splitTextToSize(condiciones, util - 10) as string[];
    const altoCond = 8 + partes.length * 4.6 + 5;
    asegurarEspacio(Math.min(altoCond, alto - 50));
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.rect(MARGEN, y, util, altoCond);
    doc.setFillColor(...NAVY);
    doc.rect(MARGEN, y, util, 8, "F");
    texto("OTRAS CONDICIONES", MARGEN + 5, y + 5.4, { bold: true, size: 9, color: [255, 255, 255] });
    partes.forEach((l, i) => texto(l, MARGEN + 5, y + 14 + i * 4.6, { bold: true, size: 8.5 }));
    y += altoCond + 4;
  }

  // ── Pie de página en todas las páginas ──
  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, alto - 14, ancho - MARGEN, alto - 14);
    texto(`Cotización ${cotizacion.numero}`, MARGEN, alto - 9, { size: 8, color: SLATE });
    texto(`Página ${p} de ${totalPaginas}`, ancho - MARGEN, alto - 9, { size: 8, color: SLATE, align: "right" });
  }

  return { blob: doc.output("blob"), nombreArchivo: nombreArchivoSeguro(cotizacion.numero) };
}
