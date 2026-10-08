import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { StockStatusBadge } from "@/components/shared/status-badge";
import { PackageCheck } from "lucide-react";
import { getEstadoStock } from "@/types";
import type { DashboardData } from "@/services/dashboard.types";

export function CriticalStock({ data }: { data: DashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock crítico y agotados</CardTitle>
      </CardHeader>
      <CardContent>
        {data.stockCritico.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Todo el stock está en niveles saludables"
            description="No hay productos agotados ni por debajo de su mínimo."
            className="py-6"
          />
        ) : (
          <ul role="list" className="divide-y divide-slate-100">
            {data.stockCritico.map((producto) => (
              <li key={producto.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-navy-900">{producto.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {producto.sku} · Stock {producto.stockActual} / mín. {producto.stockMinimo}
                  </p>
                </div>
                <StockStatusBadge estado={getEstadoStock(producto.stockActual, producto.stockMinimo)} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {data.stockCritico.length > 0 ? (
        <div className="border-t border-slate-100 px-5 py-3">
          <Link href="/productos" className="text-[13px] font-medium text-brand-600 hover:underline">
            Ver productos y stock →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}
