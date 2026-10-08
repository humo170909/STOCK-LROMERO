"use client";

import { Permitido } from "@/components/shared/permitido";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowDownCircle, ArrowUpCircle, Plus, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MEDIO_PAGO_LABEL } from "@/types";
import type { MovimientoCaja } from "@/types";

const ICONO = { ingreso_venta: Receipt, ingreso_manual: ArrowUpCircle, egreso_manual: ArrowDownCircle } as const;

export function MovementsTable({ movimientos, onRegistrar }: { movimientos: MovimientoCaja[]; onRegistrar: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Movimientos de hoy</CardTitle>
        <Permitido modulo="caja" accion="crear">
          <Button size="sm" variant="outline" onClick={onRegistrar}>
            <Plus className="size-3.5" />
            Movimiento manual
          </Button>
        </Permitido>
      </CardHeader>
      <CardContent className="px-0">
        {movimientos.length === 0 ? (
          <EmptyState title="Sin movimientos registrados hoy" className="px-5 py-8" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {movimientos.map((m) => {
              const Icon = ICONO[m.tipo];
              const esEgreso = m.tipo === "egreso_manual";
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full ${esEgreso ? "bg-red-50 text-danger-500" : "bg-emerald-50 text-emerald-700"}`}>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-navy-900">{m.concepto}</p>
                    <p className="text-xs text-slate-400">
                      {MEDIO_PAGO_LABEL[m.medioPago]} · {format(new Date(m.fecha), "HH:mm", { locale: es })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[13px] font-medium ${esEgreso ? "text-danger-500" : "text-navy-900"}`}>
                    {esEgreso ? "− " : "+ "}
                    <CurrencyDisplay value={m.monto} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
