"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { cajaService } from "@/services";
import { cn } from "@/lib/utils";

export function CloseCajaDialog({
  open,
  onOpenChange,
  montoEsperado,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  montoEsperado: number;
  onSuccess: () => void;
}) {
  const [montoReal, setMontoReal] = useState("");
  const [enviando, setEnviando] = useState(false);

  const montoRealNum = Number(montoReal) || 0;
  const diferencia = Math.round((montoRealNum - montoEsperado) * 100) / 100;

  const confirmar = async () => {
    setEnviando(true);
    try {
      await cajaService.cerrarCaja(montoRealNum);
      toast.success("Caja cerrada", {
        description: diferencia === 0 ? "Sin diferencia." : `Diferencia: S/ ${diferencia.toFixed(2)}`,
      });
      onOpenChange(false);
      setMontoReal("");
      onSuccess();
    } catch (error) {
      toast.error("No se pudo cerrar la caja", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
          <Dialog.Title className="text-sm font-semibold text-navy-900">Cerrar caja</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Cuenta el efectivo físico e ingresa el monto real.
          </Dialog.Description>

          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px]">
            <span className="text-slate-500">Efectivo esperado</span>
            <span className="font-medium text-navy-900"><CurrencyDisplay value={montoEsperado} /></span>
          </div>

          <div className="mt-3">
            <Field label="Efectivo real contado">
              <Input
                type="number"
                step="0.01"
                autoFocus
                value={montoReal}
                onChange={(e) => setMontoReal(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>

          {montoReal ? (
            <div
              className={cn(
                "mt-3 flex items-center justify-between rounded-lg px-3.5 py-2.5 text-[13px]",
                diferencia === 0 ? "bg-emerald-50" : "bg-amber-50",
              )}
            >
              <span className={diferencia === 0 ? "text-emerald-700" : "text-amber-700"}>Diferencia</span>
              <span className={cn("font-medium", diferencia === 0 ? "text-emerald-700" : "text-amber-700")}>
                {diferencia > 0 ? "+" : ""}
                <CurrencyDisplay value={diferencia} />
              </span>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={confirmar} disabled={enviando || !montoReal}>
              {enviando ? "Cerrando…" : "Confirmar cierre"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
