import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import type { Producto } from "@/types";

export type LineaCotizacionForm = {
  producto: Producto;
  cantidad: number;
  descuento: number;
};

export function useCotizacionLines() {
  const [lineas, setLineas] = useState<LineaCotizacionForm[]>([]);
  const tasaImpuesto = useAppStore((s) => s.configuracionEmpresa.impuesto);

  const agregar = (producto: Producto) => {
    setLineas((actuales) => {
      if (actuales.some((l) => l.producto.id === producto.id)) return actuales;
      return [...actuales, { producto, cantidad: 1, descuento: 0 }];
    });
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    setLineas((actuales) => actuales.map((l) => (l.producto.id === productoId ? { ...l, cantidad: Math.max(1, cantidad) } : l)));
  };

  const actualizarDescuento = (productoId: string, descuento: number) => {
    setLineas((actuales) =>
      actuales.map((l) => (l.producto.id === productoId ? { ...l, descuento: Math.max(0, descuento) } : l)),
    );
  };

  const quitar = (productoId: string) => setLineas((actuales) => actuales.filter((l) => l.producto.id !== productoId));
  const vaciar = () => setLineas([]);

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((acc, l) => acc + l.producto.precioVenta * l.cantidad - l.descuento, 0);
    const impuesto = Math.round(subtotal * tasaImpuesto * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;
    return { subtotal: Math.round(subtotal * 100) / 100, impuesto, total };
  }, [lineas, tasaImpuesto]);

  return { lineas, agregar, actualizarCantidad, actualizarDescuento, quitar, vaciar, totales };
}
