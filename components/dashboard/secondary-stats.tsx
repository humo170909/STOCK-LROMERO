import { Receipt, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CajaStatusBadge } from "@/components/shared/status-badge";
import type { DashboardData } from "@/services/dashboard.types";

export function SecondaryStats({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Card className="flex items-center gap-3 px-5 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Receipt aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-slate-500">Cantidad de ventas</p>
          <p className="text-sm font-semibold text-navy-900">{data.kpis.cantidadVentas}</p>
        </div>
      </Card>
      <Card className="flex items-center gap-3 px-5 py-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Users aria-hidden className="size-4" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-slate-500">Clientes activos</p>
          <p className="text-sm font-semibold text-navy-900">{data.kpis.clientesActivos}</p>
        </div>
      </Card>
      <Card className="flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-[13px] text-slate-500">Estado de caja</p>
          <p className="text-sm font-semibold text-navy-900">Sede Principal</p>
        </div>
        <CajaStatusBadge estado={data.estadoCaja.estado} />
      </Card>
    </div>
  );
}
