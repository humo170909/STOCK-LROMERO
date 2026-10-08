"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { SidePanel } from "@/components/shared/side-panel";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clientesService } from "@/services";
import type { Cliente } from "@/types";

const schema = z.object({
 documento: z.string().trim(),
  nombre: z.string().trim().min(3, "Ingresa el nombre o razón social."),
  telefono: z.string().trim().optional(),
  correo: z.string().trim().email("Correo inválido.").optional().or(z.literal("")),
  direccion: z.string().trim().optional(),
  lineaCredito: z.coerce.number().nonnegative("La línea de crédito no puede ser negativa."),
  riesgo: z.enum(["bajo", "medio", "alto"]),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const VALORES_VACIOS: FormInput = {
 documento: "",
  nombre: "",
  telefono: "",
  correo: "",
  direccion: "",
  lineaCredito: 0,
  riesgo: "bajo",
};

export function ClientFormPanel({
  open,
  cliente,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  cliente: Cliente | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: VALORES_VACIOS });

  useEffect(() => {
    if (!open) return;
    reset(
      cliente
        ? {
           documento: cliente.documento,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            correo: cliente.correo,
            direccion: cliente.direccion,
            lineaCredito: cliente.lineaCredito,
            riesgo: cliente.riesgo,
          }
        : VALORES_VACIOS,
    );
  }, [open, cliente, reset]);

 const riesgo = useWatch({ control, name: "riesgo" });

  const onSubmit = async (values: FormOutput) => {
    setEnviando(true);
    try {
      await clientesService.guardarCliente({
        id: cliente?.id ?? "",
        ...values,
        telefono: values.telefono ?? "",
        correo: values.correo ?? "",
        direccion: values.direccion ?? "",
        activo: cliente?.activo ?? true,
      });
      toast.success(cliente ? "Cliente actualizado" : "Cliente creado", { description: values.nombre });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo guardar el cliente", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={cliente ? "Editar cliente" : "Nuevo cliente"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <Field label="Documento (opcional)" htmlFor="documento" error={errors.documento?.message}>
            <Input id="documento" {...register("documento")} />
          </Field>

          <Field label="Nombre o razón social" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register("nombre")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Teléfono (opcional)" htmlFor="telefono">
              <Input id="telefono" {...register("telefono")} />
            </Field>
            <Field label="Correo (opcional)" htmlFor="correo" error={errors.correo?.message}>
              <Input id="correo" type="email" {...register("correo")} />
            </Field>
          </div>

          <Field label="Dirección (opcional)" htmlFor="direccion">
            <Input id="direccion" {...register("direccion")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Línea de crédito (S/)" htmlFor="lineaCredito" error={errors.lineaCredito?.message}>
              <Input id="lineaCredito" type="number" step="0.01" {...register("lineaCredito")} />
            </Field>
            <Field label="Riesgo" htmlFor="riesgo">
              <Select value={riesgo} onValueChange={(v) => setValue("riesgo", v as "bajo" | "medio" | "alto")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bajo">Bajo</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : cliente ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
