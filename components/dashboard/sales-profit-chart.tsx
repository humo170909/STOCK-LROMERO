"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/components/shared/currency-display";
import type { PuntoSerieVentas } from "@/services/dashboard.types";

function TooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-navy-900">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-slate-600">
          {item.dataKey === "ventas" ? "Ventas: " : "Ganancia: "}
          <span className="font-medium text-navy-900">{formatCurrency(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function SalesProfitChart({ serie }: { serie: PuntoSerieVentas[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y ganancia</CardTitle>
      </CardHeader>
      <CardContent>
        {serie.length === 0 ? (
          <EmptyState title="Sin ventas en este periodo" className="py-6" />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<TooltipContent />} />
                <Bar dataKey="ventas" fill="#bcd3fb" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="ganancia" stroke="#1558c0" strokeWidth={2.25} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
