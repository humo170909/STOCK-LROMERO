"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/error-state";
import { SkeletonBlock } from "@/components/shared/loading-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { trabajadoresService, usuariosService } from "@/services";
import { cn } from "@/lib/utils";
import type { AccionPermiso, ModuloSistema, PermisosRol, RolUsuario, Trabajador, Usuario } from "@/types";
import { buildColumns } from "./columns";
import { UserFormPanel } from "./user-form-panel";
import { PermissionsMatrix } from "./permissions-matrix";

type TabId = "usuarios" | "permisos";

export function UsuariosView() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [tab, setTab] = useState<TabId>("usuarios");

  useEffect(() => {
    let vigente = true;
    trabajadoresService
      .listarTrabajadores({ activo: "activos" })
      .then((lista) => {
        if (vigente) setTrabajadores(lista);
      })
      .catch((err) => {
        if (vigente) {
          toast.error("No se pudo cargar la lista de trabajadores", {
            description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, []);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [permisos, setPermisos] = useState<Record<RolUsuario, PermisosRol> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const [panelFormAbierto, setPanelFormAbierto] = useState(false);
  const [usuarioEdicion, setUsuarioEdicion] = useState<Usuario | null>(null);
  const [usuarioCambioEstado, setUsuarioCambioEstado] = useState<Usuario | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const recargar = useCallback(() => setRefreshToken((t) => t + 1), []);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [listaUsuarios, mapaPermisos] = await Promise.all([
          usuariosService.listarUsuarios(),
          usuariosService.obtenerPermisos(),
        ]);
        if (vigente) {
          setUsuarios(listaUsuarios);
          setPermisos(mapaPermisos);
        }
      } catch (err) {
        if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar usuarios y permisos.");
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => {
      vigente = false;
    };
  }, [refreshToken]);

  const confirmarCambioEstado = async () => {
    if (!usuarioCambioEstado) return;
    setCambiandoEstado(true);
    try {
      await usuariosService.cambiarEstado(usuarioCambioEstado.id, !usuarioCambioEstado.activo);
      toast.success(usuarioCambioEstado.activo ? "Usuario desactivado" : "Usuario activado", {
        description: `@${usuarioCambioEstado.usuario}`,
      });
      setUsuarioCambioEstado(null);
      recargar();
    } catch (err) {
      toast.error("No se pudo actualizar el estado", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    } finally {
      setCambiandoEstado(false);
    }
  };

  const togglePermiso = async (rol: RolUsuario, modulo: ModuloSistema, accion: AccionPermiso, valor: boolean) => {
    try {
      await usuariosService.actualizarPermiso(rol, modulo, accion, valor);
      // Se actualiza solo la casilla tocada: sin recargar toda la pantalla.
      setPermisos((prev) =>
        prev ? { ...prev, [rol]: { ...prev[rol], [modulo]: { ...prev[rol][modulo], [accion]: valor } } } : prev,
      );
    } catch (err) {
      toast.error("No se pudo actualizar el permiso", {
        description: err instanceof Error ? err.message : "Inténtalo nuevamente.",
      });
    }
  };

  const columns = buildColumns({
    trabajadores,
    onEditar: (usuario) => {
      setUsuarioEdicion(usuario);
      setPanelFormAbierto(true);
    },
    onCambiarEstado: setUsuarioCambioEstado,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">Usuarios y Permisos</h1>
          <p className="text-sm text-slate-500">Control de acceso por roles.</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/70 px-4 py-3 text-[13px] text-brand-700">
        <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <p>
          Los permisos se aplican en el servidor (Row Level Security de Supabase); ocultar un botón no es seguridad.
          Para crear un usuario con acceso, créalo primero en Supabase → Authentication → Users y luego asígnale su
          perfil (ver SUPABASE-SETUP.md).
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(["usuarios", "permisos"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3.5 py-2 text-[13px] font-medium",
              tab === t ? "bg-white text-navy-900 shadow-sm" : "text-slate-500 hover:text-navy-900",
            )}
          >
            {t === "usuarios" ? "Usuarios" : "Permisos por rol"}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={recargar} className="py-10" />
      ) : tab === "usuarios" ? (
        <Card>
          <DataTable
            columns={columns}
            data={usuarios}
            getRowId={(u) => u.id}
            emptyTitle="Sin usuarios registrados"
            emptyDescription="Los usuarios se crean en Supabase → Authentication y se les asigna un perfil."
          />
        </Card>
      ) : permisos ? (
        <PermissionsMatrix permisos={permisos} onToggle={togglePermiso} />
      ) : null}

      <UserFormPanel open={panelFormAbierto} usuario={usuarioEdicion} onOpenChange={setPanelFormAbierto} onSuccess={recargar} />

      <ConfirmDialog
        open={!!usuarioCambioEstado}
        onOpenChange={(open) => !open && setUsuarioCambioEstado(null)}
        title={usuarioCambioEstado?.activo ? "¿Desactivar usuario?" : "¿Activar usuario?"}
        description={
          usuarioCambioEstado?.activo
            ? `@${usuarioCambioEstado?.usuario} no podrá acceder al sistema.`
            : `@${usuarioCambioEstado?.usuario} volverá a estar activo.`
        }
        confirmLabel={usuarioCambioEstado?.activo ? "Desactivar" : "Activar"}
        tone={usuarioCambioEstado?.activo ? "danger" : "default"}
        loading={cambiandoEstado}
        onConfirm={confirmarCambioEstado}
      />
    </div>
  );
}
