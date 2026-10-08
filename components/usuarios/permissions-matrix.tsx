"use client";

import { Check, Lock, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccionPermiso, ModuloSistema, PermisosRol, RolUsuario } from "@/types";

// Solo el supervisor se edita: el administrador siempre tiene todo.
const ROL_EDITABLE: RolUsuario = "supervisor";

const ACCIONES: AccionPermiso[] = ["ver", "crear", "editar", "eliminar", "aprobar", "cancelar", "exportar"];
const ACCION_LABEL: Record<AccionPermiso, string> = {
  ver: "Ver",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
  aprobar: "Aprobar",
  cancelar: "Anular / cancelar",
  exportar: "Exportar",
};

const MODULOS: ModuloSistema[] = [
  "ventas",
  "cotizaciones",
  "productos",
  "inventario",
  "movimientos",
  "compras",
  "proveedores",
  "clientes",
  "caja",
  "trabajadores",
  "reportes",
];
const MODULO_LABEL: Partial<Record<ModuloSistema, string>> = {
  ventas: "Ventas",
  cotizaciones: "Cotizaciones",
  productos: "Productos",
  inventario: "Inventario (stock y ajustes)",
  movimientos: "Movimientos",
  compras: "Compras",
  proveedores: "Proveedores",
  clientes: "Clientes",
  caja: "Ingresos y Caja",
  trabajadores: "Trabajadores",
  reportes: "Reportes",
};

export function PermissionsMatrix({
  permisos,
  onToggle,
}: {
  permisos: Record<RolUsuario, PermisosRol>;
  onToggle: (rol: RolUsuario, modulo: ModuloSistema, accion: AccionPermiso, valor: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permisos del Supervisor</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <p className="px-5 pb-3 text-[13px] text-slate-500">
          El Administrador siempre tiene acceso total. Auditoría, Usuarios y Configuración son exclusivos del
          Administrador. Cada casilla concede solo esa acción.
        </p>
        <div className="thin-scroll overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-blue-50/60 text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5">Módulo</th>
                {ACCIONES.map((a) => (
                  <th key={a} className="px-3 py-2.5 text-center">
                    {ACCION_LABEL[a]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODULOS.map((modulo) => (
                <tr key={modulo}>
                  <td className="px-5 py-2 font-medium text-navy-900">{MODULO_LABEL[modulo]}</td>
                  {ACCIONES.map((accion) => {
                    const valor = permisos[ROL_EDITABLE]?.[modulo]?.[accion] ?? false;
                    return (
                      <td key={accion} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          aria-label={`${valor ? "Quitar" : "Dar"} al supervisor: ${ACCION_LABEL[accion]} en ${MODULO_LABEL[modulo]}`}
                          aria-pressed={valor}
                          onClick={() => onToggle(ROL_EDITABLE, modulo, accion, !valor)}
                          className={cn(
                            "mx-auto grid size-7 place-items-center rounded-md transition-colors",
                            valor
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                          )}
                        >
                          {valor ? <Check className="size-4" /> : <X className="size-4" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {(["auditoria", "usuarios", "configuracion"] as const).map((modulo) => (
                <tr key={modulo} className="bg-slate-50/60">
                  <td className="px-5 py-2 font-medium text-slate-500">
                    {{ auditoria: "Auditoría", usuarios: "Usuarios y Permisos", configuracion: "Configuración" }[modulo]}
                  </td>
                  <td colSpan={ACCIONES.length} className="px-3 py-2 text-center text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="size-3.5" /> Solo administrador
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
