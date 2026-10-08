"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { configuracionService } from "@/services";
import { MEDIO_PAGO_LABEL, type MedioPago } from "@/types";
import { cn } from "@/lib/utils";

const TODOS_LOS_MEDIOS: MedioPago[] = ["efectivo", "yape", "plin", "transferencia", "tarjeta", "otros"];

export function SistemaTab() {
  const empresa = useAppStore((s) => s.configuracionEmpresa);
  const mediosActivos = useAppStore((s) => s.mediosPagoActivos);
  const [impuestoInput, setImpuestoInput] = useState(String(Math.round(empresa.impuesto * 10000) / 100));
  const [guardandoImpuesto, setGuardandoImpuesto] = useState(false);
  const [medioPendiente, setMedioPendiente] = useState<MedioPago | null>(null);

  const guardarImpuesto = async () => {
    const porcentaje = Number(impuestoInput);
    if (Number.isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      toast.error("Ingresa un porcentaje válido (0 = sin impuesto).");
      return;
    }
    setGuardandoImpuesto(true);
    try {
      await configuracionService.actualizarEmpresa({ impuesto: Math.round(porcentaje * 100) / 10000 });
      toast.success("Impuesto actualizado", { description: "Afecta a las próximas ventas, compras y cotizaciones." });
    } finally {
      setGuardandoImpuesto(false);
    }
  };

  const toggleMedio = async (medio: MedioPago) => {
    const activo = mediosActivos.includes(medio);
    const nuevaLista = activo ? mediosActivos.filter((m) => m !== medio) : [...mediosActivos, medio];
    setMedioPendiente(medio);
    try {
      await configuracionService.actualizarMediosPagoActivos(nuevaLista);
    } catch (error) {
      toast.error("No se pudo actualizar", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setMedioPendiente(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Moneda y cargo adicional</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Moneda">
            <Input value="Soles (S/ · PEN)" disabled />
          </Field>
          <Field label="Impuesto / cargo (%) — 0 = sin impuesto">
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={impuestoInput}
                onChange={(e) => setImpuestoInput(e.target.value)}
              />
              <Button variant="outline" onClick={guardarImpuesto} disabled={guardandoImpuesto}>
                {guardandoImpuesto ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medios de pago activos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TODOS_LOS_MEDIOS.map((medio) => {
              const activo = mediosActivos.includes(medio);
              return (
                <button
                  key={medio}
                  type="button"
                  disabled={medioPendiente === medio}
                  onClick={() => toggleMedio(medio)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60",
                    activo ? "border-brand-500 bg-blue-50 text-brand-600" : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  {MEDIO_PAGO_LABEL[medio]}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Estos son los medios disponibles en Nueva venta, Caja y Cotizaciones. Debe quedar al menos uno activo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
