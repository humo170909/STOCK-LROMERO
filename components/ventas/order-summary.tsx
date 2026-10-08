"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { useAppStore } from "@/store/app-store";
import { PagosEditor } from "./pagos-editor";
import type { EstadoPagos } from "./use-pagos";
import type { Cliente } from "@/types";

export function OrderSummary({
  totales,
  pagos,
  observaciones,
  cliente,
  itemsCount,
  enviando,
  cajaCerrada,
  onObservacionesChange,
  onConfirmar,
}: {
  totales: { subtotal: number; descuentoTotal: number; impuesto: number; total: number };
  pagos: EstadoPagos;
  observaciones: string;
  cliente: Cliente | null;
  itemsCount: number;
  enviando: boolean;
  cajaCerrada: boolean;
  onObservacionesChange: (valor: string) => void;
  onConfirmar: () => void;
}) {
  const tasaImpuesto = useAppStore((s) => s.configuracionEmpresa.impuesto);
  const puedeConfirmar = !!cliente && itemsCount > 0 && !enviando && !cajaCerrada && pagos.valido;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen de la venta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-medium text-navy-900"><CurrencyDisplay value={totales.subtotal + totales.descuentoTotal} /></dd>
          </div>
          {totales.descuentoTotal > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Descuento</dt>
              <dd className="font-medium text-danger-500">− <CurrencyDisplay value={totales.descuentoTotal} /></dd>
            </div>
          ) : null}
          {tasaImpuesto > 0 ? (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Impuesto ({Math.round(tasaImpuesto * 10000) / 100}%)</dt>
              <dd className="font-medium text-navy-900"><CurrencyDisplay value={totales.impuesto} /></dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <dt className="font-semibold text-navy-900">Total</dt>
            <dd className="font-display text-lg font-semibold text-navy-900"><CurrencyDisplay value={totales.total} /></dd>
          </div>
        </dl>

        <PagosEditor pagos={pagos} />

        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Observaciones (opcional)</label>
          <Textarea rows={2} value={observaciones} onChange={(e) => onObservacionesChange(e.target.value)} />
        </div>

        <Button className="w-full" size="lg" disabled={!puedeConfirmar} onClick={onConfirmar}>
          {enviando ? "Confirmando…" : "Confirmar venta"}
        </Button>
        {cajaCerrada ? (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            No hay una caja abierta en esta sede. <Link href="/caja" className="font-medium underline">Abre la caja</Link> para poder vender.
          </p>
        ) : null}
        {!cliente ? <p className="text-center text-xs text-slate-400">Selecciona un cliente para continuar.</p> : null}
      </CardContent>
    </Card>
  );
}
