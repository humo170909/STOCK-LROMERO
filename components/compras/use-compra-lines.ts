import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import type { Producto } from "@/types";

export type LineaCompraForm = {
  producto: Producto;
  cantidad: number;
  costoUnitario: number;
};

export function useCompraLines() {
  const [lineas, setLineas] = useState<LineaCompraForm[]>([]);
  const tasaImpuesto = useAppStore((s) => s.configuracionEmpresa.impuesto);

  const agregar = (producto: Producto) => {
    setLineas((actuales) => {
      if (actuales.some((l) => l.producto.id === producto.id)) return actuales;
      return [...actuales, { producto, cantidad: 1, costoUnitario: producto.costo }];
    });
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    setLineas((actuales) => actuales.map((l) => (l.producto.id === productoId ? { ...l, cantidad: Math.max(1, cantidad) } : l)));
  };

  const actualizarCosto = (productoId: string, costoUnitario: number) => {
    setLineas((actuales) =>
      actuales.map((l) => (l.producto.id === productoId ? { ...l, costoUnitario: Math.max(0, costoUnitario) } : l)),
    );
  };

  const quitar = (productoId: string) => setLineas((actuales) => actuales.filter((l) => l.producto.id !== productoId));
  const vaciar = () => setLineas([]);

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
    const impuesto = Math.round(subtotal * tasaImpuesto * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;
    return { subtotal: Math.round(subtotal * 100) / 100, impuesto, total };
  }, [lineas, tasaImpuesto]);

  return { lineas, agregar, actualizarCantidad, actualizarCosto, quitar, vaciar, totales };
}
