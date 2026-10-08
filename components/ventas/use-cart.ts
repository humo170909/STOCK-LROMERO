import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import type { Producto } from "@/types";

export type CarritoItem = {
  producto: Producto;
  cantidad: number;
  descuento: number;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function useCart() {
  const [items, setItems] = useState<CarritoItem[]>([]);
  const tasaImpuesto = useAppStore((s) => s.configuracionEmpresa.impuesto);

  const agregar = (producto: Producto) => {
    setItems((actuales) => {
      const existente = actuales.find((i) => i.producto.id === producto.id);
      if (existente) {
        if (existente.cantidad >= producto.stockActual) return actuales;
        return actuales.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [...actuales, { producto, cantidad: 1, descuento: 0 }];
    });
  };

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    setItems((actuales) =>
      actuales.map((i) =>
        {
          if (i.producto.id !== productoId) return i;
          const nueva = Math.max(1, Math.min(Math.floor(cantidad) || 1, i.producto.stockActual));
          return { ...i, cantidad: nueva, descuento: Math.min(i.descuento, i.producto.precioVenta * nueva) };
        },
      ),
    );
  };

  const actualizarDescuento = (productoId: string, descuento: number) => {
    setItems((actuales) =>
      actuales.map((i) => (i.producto.id === productoId
          ? { ...i, descuento: Math.max(0, Math.min(descuento, i.producto.precioVenta * i.cantidad)) }
          : i)),
    );
  };

  const quitar = (productoId: string) => {
    setItems((actuales) => actuales.filter((i) => i.producto.id !== productoId));
  };

  const vaciar = () => setItems([]);

  const totales = useMemo(() => {
    const subtotalBruto = items.reduce((acc, i) => acc + i.producto.precioVenta * i.cantidad, 0);
    const descuentoTotal = items.reduce((acc, i) => acc + i.descuento, 0);
    const base = subtotalBruto - descuentoTotal;
    const impuesto = round2(base * tasaImpuesto);
    const total = round2(base + impuesto);
    const costoTotal = items.reduce((acc, i) => acc + i.producto.costo * i.cantidad, 0);
    const gananciaTotal = round2(base - costoTotal);
    return { subtotal: round2(base), descuentoTotal: round2(descuentoTotal), impuesto, total, costoTotal: round2(costoTotal), gananciaTotal };
  }, [items, tasaImpuesto]);

  return { items, agregar, actualizarCantidad, actualizarDescuento, quitar, vaciar, totales };
}
