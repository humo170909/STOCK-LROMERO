"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { SidePanel } from "@/components/shared/side-panel";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { trabajadoresService } from "@/services";
import type { Trabajador } from "@/types";

const schema = z.object({
  nombre: z.string().trim().min(3, "Ingresa el nombre completo."),
  documento: z.string().trim().length(8, "El DNI debe tener 8 dígitos."),
  telefono: z.string().trim().min(1, "Ingresa un teléfono."),
  cargo: z.string().trim().min(2, "Ingresa el cargo."),
  sedeId: z.string().min(1, "Selecciona una sede."),
  ingresadoEn: z.string().min(1, "Selecciona la fecha de ingreso."),
});

type FormValues = z.infer<typeof schema>;

export function TrabajadorFormPanel({
  open,
  trabajador,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  trabajador: Trabajador | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const sedes = useAppStore((s) => s.sedes);
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", documento: "", telefono: "", cargo: "", sedeId: sedes[0]?.id ?? "", ingresadoEn: format(new Date(), "yyyy-MM-dd") },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      trabajador
        ? {
            nombre: trabajador.nombre,
            documento: trabajador.documento,
            telefono: trabajador.telefono,
            cargo: trabajador.cargo,
            sedeId: trabajador.sedeId,
            ingresadoEn: trabajador.ingresadoEn.slice(0, 10),
          }
        : { nombre: "", documento: "", telefono: "", cargo: "", sedeId: sedes[0]?.id ?? "", ingresadoEn: format(new Date(), "yyyy-MM-dd") },
    );
  }, [open, trabajador, reset, sedes]);

  const sedeId = useWatch({ control, name: "sedeId" });

  const onSubmit = async (values: FormValues) => {
    setEnviando(true);
    try {
      await trabajadoresService.guardarTrabajador({
        id: trabajador?.id ?? "",
        ...values,
        ingresadoEn: values.ingresadoEn,
        usuarioId: trabajador?.usuarioId,
        activo: trabajador?.activo ?? true,
      });
      toast.success(trabajador ? "Trabajador actualizado" : "Trabajador creado", { description: values.nombre });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo guardar el trabajador", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={trabajador ? "Editar trabajador" : "Nuevo trabajador"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <Field label="Nombre completo" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register("nombre")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="DNI" htmlFor="documento" error={errors.documento?.message}>
              <Input id="documento" maxLength={8} {...register("documento")} />
            </Field>
            <Field label="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
              <Input id="telefono" {...register("telefono")} />
            </Field>
          </div>

          <Field label="Cargo" htmlFor="cargo" error={errors.cargo?.message}>
            <Input id="cargo" placeholder="Ej. Vendedor, Almacén, Cajero…" {...register("cargo")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Sede" htmlFor="sedeId" error={errors.sedeId?.message}>
              <Select value={sedeId} onValueChange={(v) => setValue("sedeId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sedes.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha de ingreso" htmlFor="ingresadoEn" error={errors.ingresadoEn?.message}>
              <Input id="ingresadoEn" type="date" {...register("ingresadoEn")} />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : trabajador ? "Guardar cambios" : "Crear trabajador"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
