import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { ReporteCompras } from "@/services";

export function ComprasTab({ reporte }: { reporte: ReporteCompras }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Cantidad de compras</p>
          <p className="mt-1 text-lg font-semibold text-navy-900">{reporte.totales.cantidadCompras}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Total comprado</p>
          <p className="mt-1 text-lg font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.totalComprado} /></p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Compras por proveedor</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {reporte.porProveedor.length === 0 ? (
              <EmptyState title="Sin compras en el periodo" className="px-5 py-6" />
            ) : (
              <ul className="thin-scroll max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {reporte.porProveedor.map((p) => (
                  <li key={p.proveedorId} className="flex items-center justify-between gap-3 px-5 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{p.nombreProveedor}</span>
                    <span className="shrink-0 text-slate-400">{p.cantidadCompras} compras</span>
                    <CurrencyDisplay value={p.totalCompras} className="shrink-0 font-medium text-navy-900" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compras por producto</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {reporte.porProducto.length === 0 ? (
              <EmptyState title="Sin compras en el periodo" className="px-5 py-6" />
            ) : (
              <ul className="thin-scroll max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {reporte.porProducto.map((p) => (
                  <li key={p.productoId} className="flex items-center justify-between gap-3 px-5 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{p.nombreProducto}</span>
                    <span className="shrink-0 text-slate-400">{p.cantidad} uds.</span>
                    <CurrencyDisplay value={p.totalCosto} className="shrink-0 font-medium text-navy-900" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compras por periodo</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {reporte.porPeriodo.length === 0 ? (
            <EmptyState title="Sin compras en el periodo" className="px-5 py-6" />
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2">Fecha</th>
                  <th className="px-3 py-2">N° compras</th>
                  <th className="px-5 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reporte.porPeriodo.map((p) => (
                  <tr key={p.fecha}>
                    <td className="px-5 py-2">{p.fecha}</td>
                    <td className="px-3 py-2 text-slate-500">{p.cantidadCompras}</td>
                    <td className="px-5 py-2 text-right font-medium text-navy-900"><CurrencyDisplay value={p.totalCompras} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
