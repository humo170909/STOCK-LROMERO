import { PackageCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StockStatusBadge } from "@/components/shared/status-badge";
import { TIPO_MOVIMIENTO_LABEL } from "@/components/movimientos/filters-bar";
import type { ReporteInventario } from "@/services";

export function InventarioTab({ reporte }: { reporte: ReporteInventario }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Unidades en stock</p>
          <p className="mt-1 text-lg font-semibold text-navy-900">{reporte.totales.unidades.toLocaleString("es-PE")}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Valorización a costo</p>
          <p className="mt-1 text-lg font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.valorCosto} /></p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Valorización a venta</p>
          <p className="mt-1 text-lg font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.valorVenta} /></p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock bajo y agotados</CardTitle>
          </CardHeader>
          <CardContent>
            {reporte.stockBajo.length === 0 && reporte.agotados.length === 0 ? (
              <EmptyState icon={PackageCheck} title="Todo el stock está en niveles saludables" className="py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...reporte.agotados, ...reporte.stockBajo].map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[13px] first:pt-0 last:pb-0">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{p.nombre}</span>
                    <StockStatusBadge estado={p.stockActual <= 0 ? "agotado" : "stock_bajo"} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Movimientos por tipo (periodo)</CardTitle>
          </CardHeader>
          <CardContent>
            {reporte.movimientosPorTipo.length === 0 ? (
              <EmptyState title="Sin movimientos en el periodo" className="py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {reporte.movimientosPorTipo.map((m) => (
                  <li key={m.tipo} className="flex items-center justify-between py-2 text-[13px] first:pt-0 last:pb-0">
                    <span className="text-slate-600">{TIPO_MOVIMIENTO_LABEL[m.tipo]}</span>
                    <span className="font-medium text-navy-900">{m.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Valorización por producto</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="thin-scroll max-h-96 overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2">Producto</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Valor costo</th>
                  <th className="px-5 py-2 text-right">Valor venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reporte.stockActual.map((item) => (
                  <tr key={item.producto.id}>
                    <td className="max-w-56 truncate px-5 py-2 font-medium text-navy-900">{item.producto.nombre}</td>
                    <td className="px-3 py-2 text-slate-500">{item.producto.stockActual}</td>
                    <td className="px-3 py-2">
                      <StockStatusBadge estado={item.estado} />
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600"><CurrencyDisplay value={item.valorCosto} /></td>
                    <td className="px-5 py-2 text-right font-medium text-navy-900"><CurrencyDisplay value={item.valorVenta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
