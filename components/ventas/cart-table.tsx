"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import type { CarritoItem } from "./use-cart";

export function CartTable({
  items,
  onCantidadChange,
  onDescuentoChange,
  onQuitar,
}: {
  items: CarritoItem[];
  onCantidadChange: (productoId: string, cantidad: number) => void;
  onDescuentoChange: (productoId: string, descuento: number) => void;
  onQuitar: (productoId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="El carrito está vacío"
        description="Busca un producto arriba para agregarlo a la venta."
        className="py-10"
      />
    );
  }

  return (
    <div className="thin-scroll overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5 first:pl-5">Producto</th>
            <th className="px-3 py-2.5">Precio</th>
            <th className="px-3 py-2.5">Costo</th>
            <th className="px-3 py-2.5">Cantidad</th>
            <th className="px-3 py-2.5">Descuento</th>
            <th className="px-3 py-2.5 text-right">Subtotal</th>
            <th className="px-4 py-2.5 last:pr-5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(({ producto, cantidad, descuento }) => {
            const subtotal = producto.precioVenta * cantidad - descuento;
            return (
              <tr key={producto.id}>
                <td className="max-w-56 px-4 py-2.5 first:pl-5">
                  <p className="truncate font-medium text-navy-900">{producto.nombre}</p>
                  <p className="text-xs text-slate-400">{producto.sku}</p>
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  <CurrencyDisplay value={producto.precioVenta} />
                </td>
                <td className="px-3 py-2.5 text-slate-400">
                  <CurrencyDisplay value={producto.costo} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Disminuir cantidad"
                      onClick={() => onCantidadChange(producto.id, cantidad - 1)}
                      className="grid size-7 pointer-coarse:size-11 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-7 text-center font-medium text-navy-900">{cantidad}</span>
                    <button
                      type="button"
                      aria-label="Aumentar cantidad"
                      disabled={cantidad >= producto.stockActual}
                      onClick={() => onCantidadChange(producto.id, cantidad + 1)}
                      className="grid size-7 pointer-coarse:size-11 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={descuento}
                    aria-label={`Descuento de ${producto.nombre}`}
                    onChange={(e) => onDescuentoChange(producto.id, Math.round((Number(e.target.value) || 0) * 100) / 100)}
                    className="h-8 pointer-coarse:h-11 w-20 rounded-md border border-slate-200 px-2 text-[13px] pointer-coarse:text-base outline-none focus-visible:border-brand-500"
                  />
                </td>
                <td className="px-3 py-2.5 text-right font-medium text-navy-900">
                  <CurrencyDisplay value={subtotal} />
                </td>
                <td className="px-4 py-2.5 text-right last:pr-5">
                  <button
                    type="button"
                    aria-label={`Quitar ${producto.nombre}`}
                    onClick={() => onQuitar(producto.id)}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-danger-500"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
