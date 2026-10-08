"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { SidePanel } from "@/components/shared/side-panel";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { proveedoresService } from "@/services";
import type { Proveedor } from "@/types";

const schema = z.object({
  razonSocial: z.string().trim().min(3, "Ingresa la razón social."),
  documento: z.string().trim(),
  telefono: z.string().trim().min(1, "Ingresa un teléfono."),
  correo: z.string().trim().email("Correo inválido.").optional().or(z.literal("")),
  direccion: z.string().trim().min(1, "Ingresa una dirección."),
  contacto: z.string().trim().optional(),
  observaciones: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

const VALORES_VACIOS: FormValues = {
  razonSocial: "",
  documento: "",
  telefono: "",
  correo: "",
  direccion: "",
  contacto: "",
  observaciones: "",
};

export function ProviderFormPanel({
  open,
  proveedor,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  proveedor: Proveedor | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: VALORES_VACIOS });

  useEffect(() => {
    if (!open) return;
    reset(
      proveedor
        ? {
            razonSocial: proveedor.razonSocial,
            documento: proveedor.documento,
            telefono: proveedor.telefono,
            correo: proveedor.correo,
            direccion: proveedor.direccion,
            contacto: proveedor.contacto,
            observaciones: proveedor.observaciones ?? "",
          }
        : VALORES_VACIOS,
    );
  }, [open, proveedor, reset]);

  const onSubmit = async (values: FormValues) => {
    setEnviando(true);
    try {
      await proveedoresService.guardarProveedor({
        id: proveedor?.id ?? "",
        ...values,
        correo: values.correo ?? "",
        contacto: values.contacto ?? "",
        activo: proveedor?.activo ?? true,
      });
      toast.success(proveedor ? "Proveedor actualizado" : "Proveedor creado", { description: values.razonSocial });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo guardar el proveedor", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={proveedor ? "Editar proveedor" : "Nuevo proveedor"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <Field label="Razón social" htmlFor="razonSocial" error={errors.razonSocial?.message}>
            <Input id="razonSocial" {...register("razonSocial")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Documento (opcional)" htmlFor="documento" error={errors.documento?.message}>
              <Input id="documento" {...register("documento")} />
            </Field>
            <Field label="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
              <Input id="telefono" {...register("telefono")} />
            </Field>
          </div>

          <Field label="Correo (opcional)" htmlFor="correo" error={errors.correo?.message}>
            <Input id="correo" type="email" {...register("correo")} />
          </Field>

          <Field label="Dirección" htmlFor="direccion" error={errors.direccion?.message}>
            <Input id="direccion" {...register("direccion")} />
          </Field>

          <Field label="Persona de contacto (opcional)" htmlFor="contacto">
            <Input id="contacto" {...register("contacto")} />
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
            {enviando ? "Guardando…" : proveedor ? "Guardar cambios" : "Crear proveedor"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
