import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import type { DashboardData } from "@/services/dashboard.types";

export function RecentActivity({ data }: { data: DashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {data.actividadReciente.length === 0 ? (
          <EmptyState title="Sin actividad reciente" className="py-6" />
        ) : (
          <ul role="list" className="space-y-3.5">
            {data.actividadReciente.map((registro) => (
              <li key={registro.id} className="flex gap-3">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                <div className="min-w-0">
                  <p className="text-[13px] text-slate-700">{registro.accion}</p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(registro.fecha), "d MMM, HH:mm", { locale: es })}
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
