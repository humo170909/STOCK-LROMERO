import { Coins, Receipt, TrendingUp, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { ResumenDiarioCaja } from "@/services";

export function ResumenDiarioCards({ resumen }: { resumen: ResumenDiarioCaja }) {
  const items = [
    { label: "Ventas del día", valor: resumen.ventasDelDia, icon: TrendingUp },
    { label: "Costo de productos vendidos", valor: resumen.costoVentas, icon: Wallet },
    { label: "Ganancia bruta", valor: resumen.gananciaBruta, icon: Coins, tono: "text-emerald-700" },
    { label: "Otros ingresos", valor: resumen.otrosIngresos, icon: Receipt },
    { label: "Total de ingresos a caja", valor: resumen.totalIngresos, icon: Receipt, tono: "text-brand-600" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desk:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] text-slate-500">{item.label}</p>
            <item.icon className="size-4 shrink-0 text-slate-300" strokeWidth={1.75} />
          </div>
          <p className={`mt-1 text-lg font-semibold ${item.tono ?? "text-navy-900"}`}>
            <CurrencyDisplay value={item.valor} />
          </p>
        </Card>
      ))}
    </div>
  );
}
