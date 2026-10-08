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
import { trabajadoresService, usuariosService } from "@/services";
import type { RolUsuario, Trabajador, Usuario } from "@/types";

const ROLES: RolUsuario[] = ["administrador", "supervisor"];
const ROL_LABEL: Record<RolUsuario, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
};

const schema = z.object({
  nombre: z.string().trim().min(3, "Ingresa el nombre completo."),
  usuario: z.string().trim().min(3, "El usuario debe tener al menos 3 caracteres.").regex(/^[a-z0-9._-]+$/i, "Solo letras, números, puntos y guiones."),
  rol: z.enum(["administrador", "supervisor"]),
  trabajadorId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function UserFormPanel({
  open,
  usuario,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  usuario: Usuario | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    let vigente = true;
    trabajadoresService.listarTrabajadores({ activo: "activos" }).then((lista) => {
      if (vigente) setTrabajadores(lista);
    });
    return () => {
      vigente = false;
    };
  }, [open]);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nombre: "", usuario: "", rol: "supervisor", trabajadorId: "" } });

  useEffect(() => {
    if (!open) return;
    reset(
      usuario
        ? { nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol, trabajadorId: usuario.trabajadorId ?? "" }
        : { nombre: "", usuario: "", rol: "supervisor", trabajadorId: "" },
    );
  }, [open, usuario, reset]);

  const rol = useWatch({ control, name: "rol" });
  const trabajadorId = useWatch({ control, name: "trabajadorId" });
  const esAdminExistente = usuario?.rol === "administrador";

  const onSubmit = async (values: FormValues) => {
    setEnviando(true);
    try {
      await usuariosService.guardarUsuario({
        id: usuario?.id ?? "",
        nombre: values.nombre,
        usuario: values.usuario.toLowerCase(),
        rol: values.rol,
        trabajadorId: values.trabajadorId || undefined,
        activo: usuario?.activo ?? true,
      });
      toast.success(usuario ? "Usuario actualizado" : "Usuario creado", { description: `@${values.usuario}` });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo guardar el usuario", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={usuario ? "Editar usuario" : "Nuevo usuario"}
      description="Para dar acceso a un usuario nuevo, créalo primero en Supabase (Authentication → Users). Ver SUPABASE-SETUP.md."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <Field label="Nombre completo" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register("nombre")} />
          </Field>

          <Field label="Usuario (para iniciar sesión)" htmlFor="usuario" error={errors.usuario?.message}>
            <Input id="usuario" placeholder="jperez" {...register("usuario")} />
          </Field>

          <Field label="Rol" htmlFor="rol">
            <Select value={rol} onValueChange={(v) => setValue("rol", v as RolUsuario)} disabled={esAdminExistente}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROL_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Trabajador vinculado (opcional)" htmlFor="trabajadorId">
            <Select value={trabajadorId || "ninguno"} onValueChange={(v) => setValue("trabajadorId", v === "ninguno" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Ninguno</SelectItem>
                {trabajadores.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre} · {t.cargo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : usuario ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
