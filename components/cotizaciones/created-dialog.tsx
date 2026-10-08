"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { Cotizacion } from "@/types";
import { PdfActions } from "./pdf-actions";

export type CotizacionCreada = { cotizacion: Cotizacion; nombreCliente: string };

export function CreatedDialog({
  creada,
  onVerCotizacion,
  onClose,
}: {
  creada: CotizacionCreada | null;
  onVerCotizacion: (cotizacionId: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={!!creada} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
          {creada ? (
            <div>
              <div className="flex flex-col items-center gap-2 bg-blue-50/60 px-6 py-6 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-6" strokeWidth={1.75} />
                </span>
                <Dialog.Title className="text-base font-semibold text-navy-900">Cotización creada correctamente</Dialog.Title>
                <Dialog.Description className="text-sm text-slate-500">{creada.cotizacion.numero}</Dialog.Description>
              </div>

              <div className="space-y-1 px-6 py-4 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Cliente</span>
                  <span className="truncate font-medium text-navy-900">{creada.nombreCliente}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-navy-900">Total</span>
                  <span className="font-display text-xl font-semibold text-navy-900">
                    <CurrencyDisplay value={creada.cotizacion.total} />
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 px-6 py-4">
                <PdfActions cotizacionId={creada.cotizacion.id} />
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => onVerCotizacion(creada.cotizacion.id)}>
                    Ver cotización
                  </Button>
                  <Button className="flex-1" onClick={onClose}>
                    Continuar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
