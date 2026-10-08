"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cn } from "@/lib/utils";
import type { AgrupacionCostoGanancia, ReporteCostoGanancia } from "@/services";

const OPCIONES: { id: AgrupacionCostoGanancia; label: string }[] = [
  { id: "dia", label: "Por día" },
  { id: "semana", label: "Por semana" },
  { id: "mes", label: "Por mes" },
  { id: "rango", label: "Todo el rango" },
];

export function CostoGananciaTab({
  reporte,
  agrupacion,
  onAgrupacionChange,
}: {
  reporte: ReporteCostoGanancia;
  agrupacion: AgrupacionCostoGanancia;
  onAgrupacionChange: (valor: AgrupacionCostoGanancia) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {OPCIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onAgrupacionChange(o.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium",
              agrupacion === o.id ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Costo y ganancia por producto</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {reporte.filas.length === 0 ? (
            <EmptyState title="Sin ventas en el periodo" className="px-5 py-8" />
          ) : (
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2">Grupo</th>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Cant. vendida</th>
                    <th className="px-3 py-2">Precio venta</th>
                    <th className="px-3 py-2">Costo unitario</th>
                    <th className="px-3 py-2 text-right">Venta total</th>
                    <th className="px-3 py-2 text-right">Costo total</th>
                    <th className="px-5 py-2 text-right">Ganancia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reporte.filas.map((f) => (
                    <tr key={`${f.grupo}-${f.productoId}`}>
                      <td className="px-5 py-2 text-slate-500">{f.grupo}</td>
                      <td className="max-w-48 truncate px-3 py-2 font-medium text-navy-900">{f.nombreProducto}</td>
                      <td className="px-3 py-2 text-slate-500">{f.cantidadVendida}</td>
                      <td className="px-3 py-2 text-slate-500"><CurrencyDisplay value={f.precioVenta} /></td>
                      <td className="px-3 py-2 text-slate-500"><CurrencyDisplay value={f.costoUnitario} /></td>
                      <td className="px-3 py-2 text-right font-medium text-navy-900"><CurrencyDisplay value={f.ventaTotal} /></td>
                      <td className="px-3 py-2 text-right text-slate-600"><CurrencyDisplay value={f.costoTotal} /></td>
                      <td className="px-5 py-2 text-right font-medium text-emerald-700"><CurrencyDisplay value={f.ganancia} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        {reporte.filas.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total vendido</p>
              <p className="text-sm font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.totalVendido} /></p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Costo total</p>
              <p className="text-sm font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.costoTotal} /></p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ganancia total</p>
              <p className="text-sm font-semibold text-emerald-700"><CurrencyDisplay value={reporte.totales.gananciaTotal} /></p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Margen %</p>
              <p className="text-sm font-semibold text-brand-600">{reporte.totales.margenPct.toFixed(1)}%</p>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
