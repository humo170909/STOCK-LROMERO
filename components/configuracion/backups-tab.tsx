"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, Eye, FileSpreadsheet, FileText, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { SidePanel } from "@/components/shared/side-panel";
import { cn } from "@/lib/utils";
import { crearBackup, listarBackups, urlDescargaBackup, type BackupItem } from "@/app/(app)/configuracion/backups-actions";

const ETAPAS = ["Preparando backup...", "Generando archivo...", "Guardando backup..."];

const FORMATOS = [
  { id: "xlsx", etiqueta: "Excel (.xlsx)", detalle: "Un libro con Resumen, Productos, Ventas, Detalle Ventas y Ganancias.", icono: FileSpreadsheet },
  { id: "csv", etiqueta: "CSV", detalle: "Un ZIP con un archivo CSV por cada tabla.", icono: FileText },
] as const;

function formatearTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ESTADO: Record<BackupItem["estado"], { texto: string; tone: "success" | "danger" | "warning" }> = {
  completado: { texto: "Completado", tone: "success" },
  error: { texto: "Con error", tone: "danger" },
  procesando: { texto: "Procesando", tone: "warning" },
};

export function BackupsTab() {
  const [formatos, setFormatos] = useState<string[]>(["xlsx", "csv"]);
  const [etapa, setEtapa] = useState<number | null>(null);
  const [items, setItems] = useState<BackupItem[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [detalle, setDetalle] = useState<BackupItem | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await listarBackups();
    if (r.ok) {
      setItems(r.items);
      setErrorCarga(false);
    } else {
      setErrorCarga(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del historial
    cargar();
  }, [cargar]);

  const creando = etapa !== null;

  const alternarFormato = (id: string) =>
    setFormatos((actual) => (actual.includes(id) ? actual.filter((f) => f !== id) : [...actual, id]));

  const crear = async () => {
    if (formatos.length === 0) return;
    setEtapa(0);
    // La acción se ejecuta en el servidor en una sola llamada; los mensajes avanzan de forma orientativa.
    const t1 = setTimeout(() => setEtapa(1), 1500);
    const t2 = setTimeout(() => setEtapa(2), 4000);
    try {
      const r = await crearBackup(formatos);
      if (r.ok) toast.success("Backup completado.");
      else toast.error("El backup no pudo completarse.");
    } catch {
      toast.error("El backup no pudo completarse.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setEtapa(null);
      cargar();
    }
  };

  const descargar = async (backup: BackupItem, ruta: string) => {
    setDescargando(ruta);
    try {
      const r = await urlDescargaBackup(backup.id, ruta);
      if (r.ok) window.location.assign(r.url);
      else toast.error("No se pudo descargar el archivo.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(null);
    }
  };

  const botonesDescarga = (b: BackupItem) =>
    b.archivos.map((a) => (
      <Button
        key={a.ruta}
        variant="outline"
        size="sm"
        disabled={descargando === a.ruta}
        onClick={() => descargar(b, a.ruta)}
        aria-label={`Descargar ${a.nombre}`}
      >
        {descargando === a.ruta ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" strokeWidth={1.75} />}
        {a.formato === "xlsx" ? "Excel" : "CSV"}
      </Button>
    ));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Backups</CardTitle>
            <CardDescription className="mt-1">Protege la información de productos, ventas y ganancias de tu empresa.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <legend className="sr-only">Formato del backup</legend>
            {FORMATOS.map((f) => {
              const activo = formatos.includes(f.id);
              return (
                <label
                  key={f.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                    activo ? "border-brand-500 bg-blue-50/50" : "border-slate-200 hover:bg-slate-50",
                    creando && "pointer-events-none opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={() => alternarFormato(f.id)}
                    disabled={creando}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-brand-500)]"
                  />
                  <f.icono aria-hidden className="mt-0.5 size-5 shrink-0 text-slate-500" strokeWidth={1.75} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-navy-900">{f.etiqueta}</span>
                    <span className="block text-xs text-slate-500">{f.detalle}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={crear} disabled={creando || formatos.length === 0} className="w-full sm:w-auto">
              {creando ? <Loader2 className="size-4 animate-spin" /> : null}
              {creando ? ETAPAS[etapa] : "Crear backup ahora"}
            </Button>
            {formatos.length === 0 ? <p className="text-xs text-slate-500">Selecciona al menos un formato.</p> : null}
            <p aria-live="polite" className="sr-only">
              {creando ? ETAPAS[etapa] : ""}
            </p>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            Los archivos se guardan en un almacenamiento privado y solo los administradores pueden consultarlos y descargarlos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de backups</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {items === null && !errorCarga ? (
            <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
          ) : errorCarga ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No se pudo cargar el historial.{" "}
              <button type="button" onClick={cargar} className="font-medium text-brand-600 underline">
                Reintentar
              </button>
            </p>
          ) : items!.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aún no hay backups. Crea el primero con el botón de arriba.</p>
          ) : (
            <>
              {/* Escritorio / tablet: tabla */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="py-2 pr-3 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Formato</th>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Tamaño</th>
                      <th className="py-2 pl-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items!.map((b) => (
                      <tr key={b.id} className="border-b border-slate-50 last:border-0">
                        <td className="whitespace-nowrap py-3 pr-3 text-navy-900">
                          {format(new Date(b.fecha), "d MMM yyyy, HH:mm", { locale: es })}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{b.tipo === "manual" ? "Manual" : "Automático"}</td>
                        <td className="px-3 py-3 text-slate-600">{b.formatos.map((f) => (f === "xlsx" ? "Excel" : "CSV")).join(" + ")}</td>
                        <td className="px-3 py-3 text-slate-600">{b.usuario}</td>
                        <td className="px-3 py-3">
                          <Badge tone={ESTADO[b.estado].tone}>{ESTADO[b.estado].texto}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600">{b.estado === "completado" ? formatearTamano(b.tamanoBytes) : "—"}</td>
                        <td className="py-3 pl-3">
                          <div className="flex justify-end gap-2">
                            {botonesDescarga(b)}
                            <Button variant="ghost" size="sm" onClick={() => setDetalle(b)}>
                              <Eye className="size-4" strokeWidth={1.75} />
                              Ver detalles
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Móvil: tarjetas */}
              <ul className="space-y-3 md:hidden">
                {items!.map((b) => (
                  <li key={b.id} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy-900">{format(new Date(b.fecha), "d MMM yyyy, HH:mm", { locale: es })}</p>
                        <p className="text-xs text-slate-500">
                          {b.tipo === "manual" ? "Manual" : "Automático"} · {b.formatos.map((f) => (f === "xlsx" ? "Excel" : "CSV")).join(" + ")}
                        </p>
                      </div>
                      <Badge tone={ESTADO[b.estado].tone}>{ESTADO[b.estado].texto}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {b.usuario}
                      {b.estado === "completado" ? ` · ${formatearTamano(b.tamanoBytes)}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {botonesDescarga(b)}
                      <Button variant="ghost" size="sm" onClick={() => setDetalle(b)}>
                        <Eye className="size-4" strokeWidth={1.75} />
                        Ver detalles
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <SidePanel
        open={!!detalle}
        onOpenChange={(open) => !open && setDetalle(null)}
        title="Detalle del backup"
        description={detalle ? format(new Date(detalle.fecha), "d 'de' MMMM yyyy, HH:mm", { locale: es }) : undefined}
      >
        {detalle ? (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <dt className="text-slate-500">Tipo</dt>
              <dd className="text-navy-900">{detalle.tipo === "manual" ? "Manual" : "Automático"}</dd>
              <dt className="text-slate-500">Usuario</dt>
              <dd className="text-navy-900">{detalle.usuario}</dd>
              <dt className="text-slate-500">Estado</dt>
              <dd>
                <Badge tone={ESTADO[detalle.estado].tone}>{ESTADO[detalle.estado].texto}</Badge>
              </dd>
              <dt className="text-slate-500">Tamaño</dt>
              <dd className="text-navy-900">{detalle.estado === "completado" ? formatearTamano(detalle.tamanoBytes) : "—"}</dd>
            </dl>

            {detalle.resumen ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
                <dt className="text-slate-500">Productos</dt>
                <dd className="text-navy-900">{detalle.resumen.productos}</dd>
                <dt className="text-slate-500">Ventas confirmadas</dt>
                <dd className="text-navy-900">{detalle.resumen.ventas}</dd>
                <dt className="text-slate-500">Ventas anuladas</dt>
                <dd className="text-navy-900">{detalle.resumen.ventas_anuladas}</dd>
                <dt className="text-slate-500">Total vendido</dt>
                <dd className="text-navy-900"><CurrencyDisplay value={detalle.resumen.total_vendido} /></dd>
                <dt className="text-slate-500">Costo total</dt>
                <dd className="text-navy-900"><CurrencyDisplay value={detalle.resumen.costo_total} /></dd>
                <dt className="text-slate-500">Ganancia bruta</dt>
                <dd className="font-medium text-navy-900"><CurrencyDisplay value={detalle.resumen.ganancia_bruta} /></dd>
              </dl>
            ) : null}

            {detalle.archivos.length > 0 ? (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-slate-500">Archivos</p>
                {detalle.archivos.map((a) => (
                  <div key={a.ruta} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-navy-900">{a.nombre}</p>
                      <p className="text-xs text-slate-500">{formatearTamano(a.tamano)}</p>
                    </div>
                    <Button variant="outline" size="sm" disabled={descargando === a.ruta} onClick={() => descargar(detalle, a.ruta)}>
                      <Download className="size-4" strokeWidth={1.75} />
                      Descargar
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </SidePanel>
    </div>
  );
}
