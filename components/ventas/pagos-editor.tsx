"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { MEDIO_PAGO_LABEL, type MedioPago } from "@/types";
import type { EstadoPagos } from "./use-pagos";

/** Medio(s) de pago de una venta: uno solo (como siempre) o repartido entre varios. */
export function PagosEditor({ pagos }: { pagos: EstadoPagos }) {
  const { lineas, medios, varios, diferencia } = pagos;

  return (
    <div>
      <label htmlFor={`medio-pago-${lineas[0].id}`} className="mb-1.5 block text-[13px] font-medium text-slate-700">{varios ? "Pago mixto" : "Medio de pago"}</label>

      <div className="space-y-2">
        {lineas.map((linea) => {
          const usadosPorOtros = new Set<MedioPago>(lineas.filter((l) => l.id !== linea.id).map((l) => l.medio));
          return (
            <div key={linea.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Select value={linea.medio} onValueChange={(v) => pagos.cambiarMedio(linea.id, v as MedioPago)}>
                  <SelectTrigger id={`medio-pago-${linea.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {medios
                      .filter((m) => m === linea.medio || !usadosPorOtros.has(m))
                      .map((m) => (
                        <SelectItem key={m} value={m}>
                          {MEDIO_PAGO_LABEL[m]}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {varios ? (
                <>
                  <Input
                    inputMode="decimal"
                    aria-label={`Monto con ${MEDIO_PAGO_LABEL[linea.medio]}`}
                    className="w-28 text-right tabular-nums"
                    value={linea.monto}
                    placeholder="0.00"
                    onChange={(e) => pagos.cambiarMonto(linea.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    aria-label={`Quitar ${MEDIO_PAGO_LABEL[linea.medio]}`}
                    onClick={() => pagos.quitar(linea.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-danger-500"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {pagos.puedeAgregar ? (
        <button
          type="button"
          onClick={pagos.agregar}
          className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:underline"
        >
          <Plus className="size-3.5" strokeWidth={2} />
          {varios ? "Agregar otro medio" : "Pagar con varios medios"}
        </button>
      ) : null}

      {varios ? (
        <p
          role="status"
          className={
            "mt-2 rounded-lg px-3 py-2 text-xs " +
            (diferencia === 0 ? "bg-emerald-50 text-emerald-800" : diferencia > 0 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-danger-600")
          }
        >
          {diferencia === 0 ? (
            "Pago completo."
          ) : diferencia > 0 ? (
            <>
              Falta <CurrencyDisplay value={diferencia} className="font-semibold" />
            </>
          ) : (
            <>
              Sobra <CurrencyDisplay value={-diferencia} className="font-semibold" />
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
