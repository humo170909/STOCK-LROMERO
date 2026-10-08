"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cajaService } from "@/services";
import { useAppStore } from "@/store/app-store";
import { MEDIO_PAGO_LABEL, type MedioPago } from "@/types";
import { cn } from "@/lib/utils";

export function ManualMovementDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const medios = useAppStore((s) => s.mediosPagoActivos);
  const [tipo, setTipo] = useState<"ingreso_manual" | "egreso_manual">("egreso_manual");
  const [medioPago, setMedioPago] = useState<MedioPago>("efectivo");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!concepto.trim() || !monto) {
      toast.error("Completa el concepto y el monto.");
      return;
    }
    setEnviando(true);
    try {
      await cajaService.registrarMovimientoManual({ tipo, medioPago, monto: Number(monto), concepto: concepto.trim() });
      toast.success("Movimiento registrado");
      onOpenChange(false);
      setMonto("");
      setConcepto("");
      onSuccess();
    } catch (error) {
      toast.error("No se pudo registrar el movimiento", {
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
          <Dialog.Title className="text-sm font-semibold text-navy-900">Movimiento manual de caja</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Para ingresos o egresos que no vienen de una venta.
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["ingreso_manual", "egreso_manual"] as const).map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setTipo(valor)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium",
                    tipo === valor
                      ? valor === "ingreso_manual"
                        ? "border-brand-500 bg-blue-50 text-brand-600"
                        : "border-danger-500 bg-red-50 text-danger-500"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {valor === "ingreso_manual" ? "Ingreso" : "Egreso"}
                </button>
              ))}
            </div>

            <Field label="Medio de pago">
              <Select value={medioPago} onValueChange={(v) => setMedioPago(v as MedioPago)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {medios.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEDIO_PAGO_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Monto (S/)">
              <Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </Field>

            <Field label="Concepto">
              <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Compra de útiles" />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={confirmar} disabled={enviando}>
              {enviando ? "Guardando…" : "Registrar"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
