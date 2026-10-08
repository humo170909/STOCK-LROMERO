import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MEDIO_PAGO_LABEL } from "@/types";
import type { ReporteVentas } from "@/services";

export function VentasTab({ reporte }: { reporte: ReporteVentas }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desk:grid-cols-4">
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Cantidad de ventas</p>
          <p className="mt-1 text-lg font-semibold text-navy-900">{reporte.totales.cantidadVentas}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Total vendido</p>
          <p className="mt-1 text-lg font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.totalVendido} /></p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Costo de ventas</p>
          <p className="mt-1 text-lg font-semibold text-navy-900"><CurrencyDisplay value={reporte.totales.totalCosto} /></p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-[12.5px] text-slate-500">Ganancia</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700"><CurrencyDisplay value={reporte.totales.totalGanancia} /></p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ventas por día</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {reporte.porDia.length === 0 ? (
              <EmptyState title="Sin ventas en el periodo" className="px-5 py-6" />
            ) : (
              <div className="thin-scroll max-h-72 overflow-y-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2">Fecha</th>
                      <th className="px-3 py-2">N°</th>
                      <th className="px-3 py-2 text-right">Vendido</th>
                      <th className="px-5 py-2 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reporte.porDia.map((d) => (
                      <tr key={d.fecha}>
                        <td className="px-5 py-2">{d.fecha}</td>
                        <td className="px-3 py-2 text-slate-500">{d.cantidadVentas}</td>
                        <td className="px-3 py-2 text-right font-medium text-navy-900"><CurrencyDisplay value={d.totalVentas} /></td>
                        <td className="px-5 py-2 text-right text-emerald-700"><CurrencyDisplay value={d.totalGanancia} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventas por medio de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {reporte.porMedioPago.length === 0 ? (
              <EmptyState title="Sin ventas en el periodo" className="py-6" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {reporte.porMedioPago.map((m) => (
                  <li key={m.medioPago} className="flex items-center justify-between py-2 text-[13px] first:pt-0 last:pb-0">
                    <span className="text-slate-600">{MEDIO_PAGO_LABEL[m.medioPago]}</span>
                    <span className="font-medium text-navy-900"><CurrencyDisplay value={m.monto} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventas por producto</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {reporte.porProducto.length === 0 ? (
              <EmptyState title="Sin ventas en el periodo" className="px-5 py-6" />
            ) : (
              <ul className="thin-scroll max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {reporte.porProducto.map((p) => (
                  <li key={p.productoId} className="flex items-center justify-between gap-3 px-5 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-slate-700">{p.nombreProducto}</span>
                    <span className="shrink-0 text-slate-400">{p.cantidad} uds.</span>
                    <CurrencyDisplay value={p.monto} className="shrink-0 font-medium text-navy-900" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventas por cliente y trabajador</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Clientes</p>
              {reporte.porCliente.length === 0 ? (
                <EmptyState title="Sin datos" className="py-4" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {reporte.porCliente.slice(0, 5).map((c) => (
                    <li key={c.clienteId} className="flex items-center justify-between py-1.5 text-[13px]">
                      <span className="truncate text-slate-600">{c.nombreCliente}</span>
                      <CurrencyDisplay value={c.totalVenta} className="font-medium text-navy-900" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Trabajadores</p>
              {reporte.porTrabajador.length === 0 ? (
                <EmptyState title="Sin datos" className="py-4" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {reporte.porTrabajador.map((t) => (
                    <li key={t.usuarioId} className="flex items-center justify-between py-1.5 text-[13px]">
                      <span className="truncate text-slate-600">{t.nombreUsuario}</span>
                      <CurrencyDisplay value={t.totalVenta} className="font-medium text-navy-900" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
