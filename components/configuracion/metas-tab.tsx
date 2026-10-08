"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ESTADO_META, formatearPorcentaje, MESES, MetaProgreso } from "@/components/shared/meta-progreso";
import { metasService, type ResumenMeta } from "@/services";

export function MetasTab() {
  const actual = metasService.mesActual();
  const [anio, setAnio] = useState(actual.anio);
  const [mes, setMes] = useState(actual.mes);
  const [montoTexto, setMontoTexto] = useState("");
  const [resumen, setResumen] = useState<ResumenMeta | null>(null);
  const [historial, setHistorial] = useState<ResumenMeta[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [refresco, setRefresco] = useState(0);

  const anios = Array.from({ length: 5 }, (_, i) => actual.anio - 1 + i);

  // Carga la meta (y las ventas reales) del mes elegido y rellena el campo si ya existe.
  useEffect(() => {
    let vigente = true;
    metasService
      .obtenerResumenMes(anio, mes)
      .then((r) => {
        if (!vigente) return;
        setResumen(r);
        setMontoTexto(r.meta !== null ? String(r.meta) : "");
        setErrorCarga(false);
      })
      .catch(() => vigente && setErrorCarga(true));
    return () => {
      vigente = false;
    };
  }, [anio, mes, refresco]);

  const cargarHistorial = useCallback(() => {
    metasService
      .listarHistorial()
      .then(setHistorial)
      .catch(() => setErrorCarga(true));
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial, refresco]);

  const guardar = async () => {
    const meta = Number(montoTexto);
    if (!montoTexto.trim() || !Number.isFinite(meta) || meta <= 0) {
      toast.error("Ingresa un monto de meta mayor a 0.");
      return;
    }
    setGuardando(true);
    try {
      await metasService.guardarMeta({ anio, mes, meta });
      toast.success(resumen?.meta !== null ? "Meta actualizada" : "Meta guardada", { description: `${MESES[mes - 1]} ${anio}` });
      setRefresco((n) => n + 1);
    } catch (error) {
      toast.error("No se pudo guardar la meta", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const existe = resumen !== null && resumen.meta !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Meta mensual de ventas</CardTitle>
            <CardDescription className="mt-1">Define cuánto quieres vender en un mes y sigue el avance con las ventas reales.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
            <Field label="Año">
              <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anios.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mes">
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((nombre, i) => (
                    <SelectItem key={nombre} value={String(i + 1)}>
                      {nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Meta (S/)" htmlFor="meta-monto">
              <Input
                id="meta-monto"
                type="number"
                min={0.01}
                step="0.01"
                inputMode="decimal"
                value={montoTexto}
                onChange={(e) => setMontoTexto(e.target.value)}
                placeholder="Ej. 30000"
              />
            </Field>
            <Button onClick={guardar} disabled={guardando || resumen === null} className="w-full sm:w-auto">
              {guardando ? "Guardando…" : existe ? "Actualizar meta" : "Guardar meta"}
            </Button>
          </div>

          {errorCarga ? (
            <p className="text-sm text-slate-500">No se pudo cargar la información de metas.</p>
          ) : resumen ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="mb-2 text-[13px] font-medium text-slate-500">
                {MESES[mes - 1]} {anio}
              </p>
              <MetaProgreso resumen={resumen} />
            </div>
          ) : (
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de metas</CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          {historial === null ? (
            <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
          ) : historial.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aún no hay metas registradas.</p>
          ) : (
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-3 font-medium">Mes</th>
                    <th className="px-3 py-2 text-right font-medium">Meta</th>
                    <th className="px-3 py-2 text-right font-medium">Ventas</th>
                    <th className="px-3 py-2 text-right font-medium">Cumplimiento</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="py-2 pl-3" />
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={`${h.anio}-${h.mes}`} className="border-b border-slate-50 last:border-0">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-navy-900">
                        {MESES[h.mes - 1]} {h.anio}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{h.meta !== null ? <CurrencyDisplay value={h.meta} /> : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">
                        <CurrencyDisplay value={h.ventas} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-navy-900">{h.porcentaje !== null ? formatearPorcentaje(h.porcentaje) : "—"}</td>
                      <td className="px-3 py-2.5">
                        {h.estado !== "sin_meta" ? (
                          <Badge tone={ESTADO_META[h.estado].tone} dot>
                            {ESTADO_META[h.estado].texto}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAnio(h.anio);
                            setMes(h.mes);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          <Pencil className="size-4" strokeWidth={1.75} />
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
