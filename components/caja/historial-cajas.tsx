import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { AperturaCierreCaja } from "@/types";

export function HistorialCajas({ historial }: { historial: AperturaCierreCaja[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de cierres</CardTitle>
      </CardHeader>
      <CardContent>
        {historial.length === 0 ? (
          <EmptyState title="Sin cierres anteriores" className="py-6" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {historial.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px] first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-navy-900">{format(new Date(c.abiertaEn), "d MMM yyyy", { locale: es })}</p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(c.abiertaEn), "HH:mm")} – {c.cerradaEn ? format(new Date(c.cerradaEn), "HH:mm") : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">
                    Esperado <CurrencyDisplay value={c.montoCierreEsperado ?? 0} />
                  </p>
                  <p className={c.diferencia === 0 ? "text-emerald-700" : "font-medium text-amber-700"}>
                    Diferencia <CurrencyDisplay value={c.diferencia ?? 0} signed />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
