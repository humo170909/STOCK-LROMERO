"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { montoEnLetras } from "@/lib/numero-a-letras";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { MEDIO_PAGO_LABEL, MEDIO_PAGO_VENTA_LABEL } from "@/types";
import type { Cliente, DetalleVenta, PagoVenta, Venta } from "@/types";

export function ReceiptDialog({
  venta,
  detalle,
  cliente,
  pagos = [],
  onClose,
}: {
  venta: Venta | null;
  detalle: DetalleVenta[];
  cliente: Cliente | null;
  pagos?: PagoVenta[];
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={!!venta} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
          {venta ? (
            <div>
              <div className="flex flex-col items-center gap-2 bg-blue-50/60 px-6 py-6 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-6" strokeWidth={1.75} />
                </span>
                <Dialog.Title className="text-base font-semibold text-navy-900">Venta confirmada</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">
                  Nota de venta {venta.numero}
                </Dialog.Description>
              </div>

              <div className="border-b border-slate-100 px-6 py-3 text-center">
                <p className="text-sm font-semibold tracking-wide text-navy-900">{EMPRESA_DOCUMENTOS.nombre}</p>
                <p className="text-xs text-slate-500">RUC N° {EMPRESA_DOCUMENTOS.ruc}</p>
                <p className="text-xs text-slate-500">{EMPRESA_DOCUMENTOS.direccion}</p>
              </div>

              <div className="thin-scroll max-h-72 overflow-y-auto px-6 py-4">
                <div className="mb-3 flex items-center justify-between text-[13px] text-slate-500">
                  <span>{cliente?.nombre}</span>
                  <span>{format(new Date(venta.fecha), "d MMM yyyy, HH:mm", { locale: es })}</span>
                </div>
                <ul className="space-y-1.5 text-[13px]">
                  {detalle.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-slate-700">
                        {d.cantidad} × {d.nombreProducto}
                      </span>
                      <CurrencyDisplay value={d.subtotal} className="shrink-0 font-medium text-navy-900" />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Medio de pago</span>
                  <span className="font-medium text-navy-900">{MEDIO_PAGO_VENTA_LABEL[venta.medioPago]}</span>
                </div>
                {pagos.length > 1 ? (
                  <ul className="mt-1 space-y-0.5 text-[13px]">
                    {pagos.map((p) => (
                      <li key={p.medioPago} className="flex items-center justify-between text-slate-500">
                        <span>{MEDIO_PAGO_LABEL[p.medioPago]}</span>
                        <CurrencyDisplay value={p.monto} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy-900">Total</span>
                  <span className="font-display text-xl font-semibold text-navy-900">
                    <CurrencyDisplay value={venta.total} />
                  </span>
                </div>
                <p className="mt-2 text-xs italic text-slate-400">{montoEnLetras(venta.total)}</p>
              </div>

              <div className="border-t border-slate-100 px-6 py-4">
                <Button className="w-full" onClick={onClose}>
                  Nueva venta
                </Button>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
