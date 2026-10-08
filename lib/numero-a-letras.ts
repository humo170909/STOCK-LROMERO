const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const ESPECIALES = [
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
  "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
];
const DECENAS = [
  "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA",
  "SESENTA", "SETENTA", "OCHENTA", "NOVENTA",
];
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function bloqueDeTres(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";

  const c = Math.floor(n / 100);
  const resto = n % 100;
  let texto = c > 0 ? CENTENAS[c] : "";

  if (resto > 0) {
    if (texto) texto += " ";
    if (resto < 10) {
      texto += UNIDADES[resto];
    } else if (resto < 20) {
      texto += ESPECIALES[resto - 10];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      if (d === 2 && u > 0) {
        texto += `VEINTI${UNIDADES[u].toLowerCase()}`.toUpperCase();
      } else {
        texto += DECENAS[d];
        if (u > 0) texto += ` Y ${UNIDADES[u]}`;
      }
    }
  }
  return texto;
}

/** Apócope de UNO antes de MIL / MILLONES: "TREINTA Y UNO" -> "TREINTA Y UN", "VEINTIUNO" -> "VEINTIÚN". */
function apocopar(texto: string): string {
  if (texto.endsWith("VEINTIUNO")) return texto.slice(0, -9) + "VEINTIÚN";
  if (texto.endsWith("UNO")) return texto.slice(0, -1);
  return texto;
}

function enteroALetras(n: number): string {
  if (n === 0) return "CERO";

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;

  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLÓN" : `${apocopar(bloqueDeTres(millones))} MILLONES`);
  }
  if (miles > 0) {
    partes.push(miles === 1 ? "MIL" : `${apocopar(bloqueDeTres(miles))} MIL`);
  }
  if (resto > 0) {
    partes.push(bloqueDeTres(resto));
  }
  return partes.join(" ").trim();
}

/** Ej: montoEnLetras(1234.5) -> "MIL DOSCIENTOS TREINTA Y CUATRO CON 50/100 SOLES" */
export function montoEnLetras(monto: number, moneda = "SOLES"): string {
  const entero = Math.floor(Math.abs(monto));
  const centimos = Math.round((Math.abs(monto) - entero) * 100);
  return `${enteroALetras(entero)} CON ${centimos.toString().padStart(2, "0")}/100 ${moneda}`;
}
