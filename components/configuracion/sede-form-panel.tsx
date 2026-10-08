"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { SidePanel } from "@/components/shared/side-panel";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { configuracionService } from "@/services";
import type { Sede } from "@/types";

const schema = z.object({
  nombre: z.string().trim().min(2, "Ingresa el nombre de la sede."),
  direccion: z.string().trim().min(2, "Ingresa la dirección."),
  telefono: z.string().trim().min(1, "Ingresa un teléfono."),
});

type FormValues = z.infer<typeof schema>;

export function SedeFormPanel({
  open,
  sede,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  sede: Sede | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nombre: "", direccion: "", telefono: "" } });

  useEffect(() => {
    if (!open) return;
    reset(sede ? { nombre: sede.nombre, direccion: sede.direccion, telefono: sede.telefono } : { nombre: "", direccion: "", telefono: "" });
  }, [open, sede, reset]);

  const onSubmit = async (values: FormValues) => {
    setEnviando(true);
    try {
      await configuracionService.guardarSede({ id: sede?.id ?? "", ...values, activa: sede?.activa ?? true });
      toast.success(sede ? "Sede actualizada" : "Sede creada", { description: values.nombre });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo guardar la sede", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={sede ? "Editar sede" : "Nueva sede"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register("nombre")} />
          </Field>
          <Field label="Dirección" htmlFor="direccion" error={errors.direccion?.message}>
            <Input id="direccion" {...register("direccion")} />
          </Field>
          <Field label="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
            <Input id="telefono" {...register("telefono")} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : sede ? "Guardar cambios" : "Crear sede"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
