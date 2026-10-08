import { useCallback, useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import type { MedioPago, PagoVenta } from "@/types";

type LineaGuardada = { id: number; medio: MedioPago | null; monto: string; manual: boolean };

export type LineaPago = { id: number; medio: MedioPago; monto: string; esAuto: boolean };

const aCentavos = (valor: number) => Math.round(valor * 100);
const textoMonto = (centavos: number) => (centavos / 100).toFixed(2);
const leerCentavos = (texto: string) => {
  const n = Number(texto);
  return Number.isFinite(n) ? aCentavos(n) : 0;
};
const inicial = (): LineaGuardada[] => [{ id: 1, medio: null, monto: "", manual: false }];

/**
 * Reparte el total de una venta entre uno o más medios de pago.
 * - Con un solo medio todo es automático (monto = total) y la venta funciona como siempre.
 * - Con varios, la última línea se autocompleta con lo que falta mientras no se edite a mano.
 */
export function usePagos(total: number) {
  const mediosActivos = useAppStore((s) => s.mediosPagoActivos);
  const [guardadas, setGuardadas] = useState<LineaGuardada[]>(inicial);
  const [siguienteId, setSiguienteId] = useState(2);

  const totalC = aCentavos(total);
  const medios: MedioPago[] = mediosActivos.length > 0 ? mediosActivos : ["efectivo"];

  // Resuelve el medio de cada línea (sin repetidos y solo entre los activos) y su monto mostrado.
  const lineas = useMemo<LineaPago[]>(() => {
    const usados = new Set<MedioPago>();
    const resultado: LineaPago[] = [];
    let acumuladoC = 0;
    for (let i = 0; i < guardadas.length; i++) {
      const l = guardadas[i];
      const medio =
        l.medio && medios.includes(l.medio) && !usados.has(l.medio)
          ? l.medio
          : (medios.find((m) => !usados.has(m)) ?? medios[0]);
      usados.add(medio);
      const esAuto = i === guardadas.length - 1 && !l.manual;
      const centavos = esAuto ? Math.max(0, totalC - acumuladoC) : leerCentavos(l.monto);
      acumuladoC += centavos;
      resultado.push({ id: l.id, medio, monto: esAuto ? textoMonto(centavos) : l.monto, esAuto });
    }
    return resultado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardadas, totalC, mediosActivos]);

  const sumaC = lineas.reduce((acc, l) => acc + leerCentavos(l.monto), 0);
  const diferenciaC = totalC - sumaC; // > 0 falta, < 0 sobra
  const varios = lineas.length > 1;
  const valido = varios
    ? totalC > 0 && diferenciaC === 0 && lineas.every((l) => leerCentavos(l.monto) > 0)
    : true;
  const puedeAgregar = totalC > 0 && lineas.length < medios.length;

  const agregar = useCallback(() => {
    if (!puedeAgregar) return;
    setGuardadas(() => {
      // Congela lo mostrado hoy; si el único medio cubre todo el total, se parte a la mitad
      // para que el nuevo medio reciba el resto.
      const congeladas: LineaGuardada[] = lineas.map((l) => ({ id: l.id, medio: l.medio, monto: l.monto, manual: true }));
      if (congeladas.length === 1) congeladas[0] = { ...congeladas[0], monto: textoMonto(Math.floor(totalC / 2)) };
      return [...congeladas, { id: siguienteId, medio: null, monto: "", manual: false }];
    });
    setSiguienteId((n) => n + 1);
  }, [lineas, puedeAgregar, siguienteId, totalC]);

  const quitar = useCallback(
    (id: number) => {
      setGuardadas(() => {
        const restantes: LineaGuardada[] = lineas.filter((l) => l.id !== id).map((l) => ({ id: l.id, medio: l.medio, monto: l.monto, manual: true }));
        if (restantes.length === 0) return inicial();
        // La nueva última línea vuelve a autocompletarse con lo que falta.
        restantes[restantes.length - 1] = { ...restantes[restantes.length - 1], manual: false };
        return restantes;
      });
    },
    [lineas],
  );

  const cambiarMedio = useCallback(
    (id: number, medio: MedioPago) => {
      setGuardadas(lineas.map((l) => ({ id: l.id, medio: l.id === id ? medio : l.medio, monto: l.monto, manual: !l.esAuto })));
    },
    [lineas],
  );

  const cambiarMonto = useCallback(
    (id: number, texto: string) => {
      const limpio = texto.replace(",", ".");
      if (!/^\d*\.?\d{0,2}$/.test(limpio)) return;
      setGuardadas(lineas.map((l) => ({ id: l.id, medio: l.medio, monto: l.id === id ? limpio : l.monto, manual: l.id === id ? true : !l.esAuto })));
    },
    [lineas],
  );

  const reset = useCallback(() => {
    setGuardadas(inicial());
  }, []);

  const pagos: PagoVenta[] | undefined = varios ? lineas.map((l) => ({ medioPago: l.medio, monto: leerCentavos(l.monto) / 100 })) : undefined;

  return {
    lineas,
    medios,
    varios,
    valido,
    diferencia: diferenciaC / 100,
    puedeAgregar,
    /** Medio principal (el de la primera línea): es el que se envía cuando hay un solo medio. */
    medioPago: lineas[0].medio,
    /** Solo con 2 o más medios; con uno, la venta se envía como siempre con `medioPago`. */
    pagos,
    agregar,
    quitar,
    cambiarMedio,
    cambiarMonto,
    reset,
  };
}

export type EstadoPagos = ReturnType<typeof usePagos>;
