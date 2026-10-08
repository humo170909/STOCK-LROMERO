"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SidePanel } from "@/components/shared/side-panel";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Separator } from "@/components/ui/separator";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { comprasService, type DetalleCompraCompleto } from "@/services";

export function DetailPanel({ compraId, onOpenChange }: { compraId: string | null; onOpenChange: (open: boolean) => void }) {
  const [datos, setDatos] = useState<DetalleCompraCompleto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!compraId) return;
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      setDatos(null);
      try {
        const resultado = await comprasService.obtenerDetalleCompra(compraId as string);
        if (vigente) setDatos(resultado);
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el detalle.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [compraId]);

  return (
    <SidePanel
      open={!!compraId}
      onOpenChange={onOpenChange}
      title={datos ? datos.compra.numeroDocumento : "Detalle de compra"}
      description={datos?.proveedor?.razonSocial}
    >
      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} />
      ) : datos ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <p className="text-slate-400">Proveedor</p>
              <p className="font-medium text-navy-900">{datos.proveedor?.razonSocial ?? "—"}</p>
              <p className="text-slate-500">{datos.proveedor?.documento}</p>
            </div>
            <div>
              <p className="text-slate-400">Fecha</p>
              <p className="font-medium text-navy-900">{format(new Date(datos.compra.fecha), "d MMM yyyy, HH:mm", { locale: es })}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-700">Productos</p>
            <ul className="space-y-2.5">
              {datos.detalle.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-navy-900">{d.nombreProducto}</p>
                    <p className="text-xs text-slate-500">
                      {d.cantidad} × <CurrencyDisplay value={d.costoUnitario} />
                    </p>
                  </div>
                  <CurrencyDisplay value={d.subtotal} className="shrink-0 font-medium text-navy-900" />
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <dl className="space-y-1.5 text-[13px]">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.compra.subtotal} /></dd>
            </div>
            {datos.compra.impuesto > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Impuesto</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={datos.compra.impuesto} /></dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm">
              <dt className="font-semibold text-navy-900">Total</dt>
              <dd className="font-display text-base font-semibold text-navy-900"><CurrencyDisplay value={datos.compra.total} /></dd>
            </div>
          </dl>
          {datos.compra.observaciones ? (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{datos.compra.observaciones}</p>
          ) : null}
        </div>
      ) : null}
    </SidePanel>
  );
}
