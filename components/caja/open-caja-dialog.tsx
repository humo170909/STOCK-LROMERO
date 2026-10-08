"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cajaService } from "@/services";

export function OpenCajaDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await cajaService.abrirCaja(Number(monto) || 0);
      toast.success("Caja abierta");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo abrir la caja", {
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(380px,92vw)] -translate-x-1/2 -translate-y-1/2 max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
          <Dialog.Title className="text-sm font-semibold text-navy-900">Abrir caja</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Registra el monto inicial de efectivo con el que empiezas el turno.
          </Dialog.Description>

          <div className="mt-4">
            <Field label="Monto de apertura">
              <Input type="number" step="0.01" autoFocus value={monto} onChange={(e) => setMonto(e.target.value)} />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={confirmar} disabled={enviando || monto === ""}>
              {enviando ? "Abriendo…" : "Abrir caja"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
