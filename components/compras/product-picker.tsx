"use client";

import { useEffect, useRef, useState } from "react";
import { Package, Search } from "lucide-react";
import { productosService } from "@/services";
import type { Producto } from "@/types";

export function ProductPicker({ onSelect }: { onSelect: (producto: Producto) => void }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vigente = true;
    productosService.listarProductos({ activo: "activos" }).then((lista) => {
      if (vigente) setProductos(lista);
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    function onClickFuera(event: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  const resultados = productos
    .filter((p) => p.activo)
    .filter((p) => {
      const t = texto.trim().toLowerCase();
      return !t || p.nombre.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t);
    })
    .slice(0, 20);

  return (
    <div ref={contenedorRef} className="relative">
      <div className="flex h-11 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 focus-within:border-brand-500">
        <Search aria-hidden className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar producto por nombre o SKU…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {abierto && resultados.length > 0 ? (
        <div className="thin-scroll absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_-16px_rgb(15_28_51/0.3)]">
          {resultados.map((producto) => (
            <button
              key={producto.id}
              type="button"
              onClick={() => {
                onSelect(producto);
                setTexto("");
                setAbierto(false);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-blue-50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400">
                <Package className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-navy-900">{producto.nombre}</span>
                <span className="block text-xs text-slate-500">
                  {producto.sku} · Costo actual S/ {producto.costo.toFixed(2)}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
