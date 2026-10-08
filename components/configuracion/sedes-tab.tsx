"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, MapPin, Pencil, Power, PowerOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAppStore } from "@/store/app-store";
import { configuracionService } from "@/services";
import type { Sede } from "@/types";
import { SedeFormPanel } from "./sede-form-panel";

export function SedesTab() {
  const sedes = useAppStore((s) => s.sedes);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [sedeEdicion, setSedeEdicion] = useState<Sede | null>(null);
  const [sedeCambioEstado, setSedeCambioEstado] = useState<Sede | null>(null);
  const [cambiando, setCambiando] = useState(false);

  const confirmarCambioEstado = async () => {
    if (!sedeCambioEstado) return;
    setCambiando(true);
    try {
      await configuracionService.cambiarEstadoSede(sedeCambioEstado.id, !sedeCambioEstado.activa);
      toast.success(sedeCambioEstado.activa ? "Sede desactivada" : "Sede activada", { description: sedeCambioEstado.nombre });
      setSedeCambioEstado(null);
    } catch (error) {
      toast.error("No se pudo actualizar la sede", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setCambiando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sedes</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setSedeEdicion(null);
            setPanelAbierto(true);
          }}
        >
          <Plus className="size-3.5" />
          Nueva sede
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100">
          {sedes.map((sede) => (
            <li key={sede.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-brand-600">
                  <MapPin className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-navy-900">{sede.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {sede.direccion} · {sede.telefono}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={sede.activa ? "success" : "neutral"}>{sede.activa ? "Activa" : "Inactiva"}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${sede.nombre}`}
                  onClick={() => {
                    setSedeEdicion(sede);
                    setPanelAbierto(true);
                  }}
                >
                  <Pencil className="size-4" strokeWidth={1.75} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={sede.activa ? `Desactivar ${sede.nombre}` : `Activar ${sede.nombre}`}
                  onClick={() => setSedeCambioEstado(sede)}
                >
                  {sede.activa ? <PowerOff className="size-4" strokeWidth={1.75} /> : <Power className="size-4" strokeWidth={1.75} />}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <SedeFormPanel open={panelAbierto} sede={sedeEdicion} onOpenChange={setPanelAbierto} onSuccess={() => {}} />

      <ConfirmDialog
        open={!!sedeCambioEstado}
        onOpenChange={(open) => !open && setSedeCambioEstado(null)}
        title={sedeCambioEstado?.activa ? "¿Desactivar sede?" : "¿Activar sede?"}
        description={
          sedeCambioEstado?.activa
            ? `${sedeCambioEstado?.nombre} dejará de estar disponible en el selector de sede.`
            : `${sedeCambioEstado?.nombre} volverá a estar disponible.`
        }
        confirmLabel={sedeCambioEstado?.activa ? "Desactivar" : "Activar"}
        tone={sedeCambioEstado?.activa ? "danger" : "default"}
        loading={cambiando}
        onConfirm={confirmarCambioEstado}
      />
    </Card>
  );
}
