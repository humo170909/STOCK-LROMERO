"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { useAppStore } from "@/store/app-store";
import { configuracionService } from "@/services";

const schema = z.object({
  nombre: z.string().trim().min(2, "Ingresa el nombre comercial."),
  razonSocial: z.string().trim().min(2, "Ingresa la razón social."),
  documento: z.string().trim(),
  direccion: z.string().trim().min(2, "Ingresa la dirección."),
  telefono: z.string().trim().min(1, "Ingresa un teléfono."),
  correo: z.string().trim().email("Correo inválido."),
});

type FormValues = z.infer<typeof schema>;

export function EmpresaTab() {
  const empresa = useAppStore((s) => s.configuracionEmpresa);
  const estadoEmpresa = useAppStore((s) => s.estadoEmpresa);
  const cargarSesionReal = useAppStore((s) => s.cargarSesionReal);
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: empresa });

  useEffect(() => {
    reset(empresa);
  }, [empresa, reset]);

  const onSubmit = async (values: FormValues) => {
    setEnviando(true);
    try {
      await configuracionService.actualizarEmpresa(values);
      toast.success("Cambios guardados correctamente.");
    } catch (error) {
      toast.error("No se pudo guardar", {
        description: error instanceof Error ? error.message : "No se pudo guardar la información de la empresa.",
      });
    } finally {
      setEnviando(false);
    }
  };

  if (estadoEmpresa === "cargando") {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  if (estadoEmpresa === "sin_empresa_asignada") {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="El usuario no tiene una empresa asignada."
            description="Tu perfil (public.profiles) no tiene empresa_id configurado. Pide a un administrador que complete ese dato — la app no puede inventarlo."
          />
        </CardContent>
      </Card>
    );
  }

  if (estadoEmpresa === "empresa_no_encontrada") {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="No existe una empresa configurada para este usuario."
            description="Tu perfil apunta a un empresa_id que no existe en public.empresas."
          />
        </CardContent>
      </Card>
    );
  }

  if (estadoEmpresa === "error") {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="No se pudo cargar la información de la empresa."
            description="Ocurrió un error al consultar Supabase. Verifica tu conexión e inténtalo de nuevo."
            onRetry={cargarSesionReal}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la empresa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white p-2">
              <Image src={empresa.logoUrl} alt="Logo" width={48} height={48} className="h-auto w-full object-contain" />
            </div>
            <p className="text-xs text-slate-400">
              El logo se gestiona desde <code>/public/logo.png</code>. La carga de archivos aún no está disponible.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre comercial" htmlFor="nombre" error={errors.nombre?.message}>
              <Input id="nombre" {...register("nombre")} />
            </Field>
            <Field label="Razón social" htmlFor="razonSocial" error={errors.razonSocial?.message}>
              <Input id="razonSocial" {...register("razonSocial")} />
            </Field>
            <Field label="Documento (opcional)" htmlFor="documento" error={errors.documento?.message}>
              <Input id="documento" {...register("documento")} />
            </Field>
            <Field label="Teléfono" htmlFor="telefono" error={errors.telefono?.message}>
              <Input id="telefono" {...register("telefono")} />
            </Field>
            <Field label="Correo" htmlFor="correo" error={errors.correo?.message}>
              <Input id="correo" type="email" {...register("correo")} />
            </Field>
            <Field label="Dirección" htmlFor="direccion" error={errors.direccion?.message}>
              <Input id="direccion" {...register("direccion")} />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={enviando || !isDirty}>
              {enviando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
