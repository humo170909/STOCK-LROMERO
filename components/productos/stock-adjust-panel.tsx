"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { SidePanel } from "@/components/shared/side-panel";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { productosService } from "@/services";
import type { Producto } from "@/types";

const schema = z.object({
  tipo: z.enum(["entrada", "salida"]),
  cantidad: z.coerce.number().int("Ingresa un número entero.").positive("La cantidad debe ser mayor a 0."),
  motivo: z.string().trim().min(3, "Describe el motivo del ajuste."),
  documentoSustento: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

// z.coerce acepta "unknown" como tipo de entrada; FormInput es lo que maneja el formulario
// (antes de coercionar) y FormOutput es lo que recibe onSubmit (ya validado y coercionado).
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function StockAdjustPanel({
  producto,
  onOpenChange,
  onSuccess,
}: {
  producto: Producto | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "entrada", cantidad: 1, motivo: "", documentoSustento: "", observaciones: "" },
  });

  useEffect(() => {
    if (producto) reset({ tipo: "entrada", cantidad: 1, motivo: "", documentoSustento: "", observaciones: "" });
  }, [producto, reset]);

  const tipo = useWatch({ control, name: "tipo" });
  const cantidad = Number(useWatch({ control, name: "cantidad" })) || 0;
  const nuevoStock = producto ? producto.stockActual + (tipo === "entrada" ? cantidad : -cantidad) : 0;

  const onSubmit = async (values: FormOutput) => {
    if (!producto) return;
    setEnviando(true);
    try {
      await productosService.ajustarStock({ productoId: producto.id, ...values });
      toast.success("Stock actualizado", {
        description: `${producto.sku} ahora tiene ${nuevoStock} ${producto.unidad}.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo ajustar el stock", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel
      open={!!producto}
      onOpenChange={onOpenChange}
      title="Ajuste de stock rápido"
      description={producto ? `${producto.nombre} · ${producto.sku}` : undefined}
    >
      {producto ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              {(["entrada", "salida"] as const).map((valor) => (
                <label
                  key={valor}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 pointer-coarse:min-h-11 text-sm font-medium transition-colors",
                    tipo === valor
                      ? valor === "entrada"
                        ? "border-brand-500 bg-blue-50 text-brand-600"
                        : "border-danger-500 bg-red-50 text-danger-500"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <input type="radio" value={valor} {...register("tipo")} className="sr-only" />
                  {valor === "entrada" ? (
                    <ArrowUpCircle className="size-4" strokeWidth={1.75} />
                  ) : (
                    <ArrowDownCircle className="size-4" strokeWidth={1.75} />
                  )}
                  {valor === "entrada" ? "Entrada" : "Salida"}
                </label>
              ))}
            </div>

            <Field label="Cantidad" htmlFor="cantidad" error={errors.cantidad?.message}>
              <Input id="cantidad" type="number" min={1} step={1} {...register("cantidad")} />
            </Field>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-3">
              <span className="text-[13px] text-slate-500">Stock actual → nuevo stock</span>
              <span className="text-sm font-semibold text-navy-900">
                {producto.stockActual} → <span className={nuevoStock < 0 ? "text-danger-500" : "text-brand-600"}>{nuevoStock}</span>{" "}
                {producto.unidad}
              </span>
            </div>

            <Field label="Motivo" htmlFor="motivo" error={errors.motivo?.message}>
              <Input id="motivo" placeholder="Ej. Conteo físico, devolución, merma…" {...register("motivo")} />
            </Field>

            <Field label="Documento de sustento (opcional)" htmlFor="documento">
              <Input id="documento" placeholder="Ej. Acta de conteo N° 014" {...register("documentoSustento")} />
            </Field>

            <Field label="Observaciones (opcional)" htmlFor="observaciones">
              <Textarea id="observaciones" rows={3} {...register("observaciones")} />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Guardando…" : "Confirmar ajuste"}
            </Button>
          </div>
        </form>
      ) : null}
    </SidePanel>
  );
}
