"use client";

import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/app-store";

export function SedeSelector() {
  const sedes = useAppStore((s) => s.sedes);
  const sedeActualId = useAppStore((s) => s.sedeActualId);
  const setSedeActual = useAppStore((s) => s.setSedeActual);
  const sedeActual = sedes.find((s) => s.id === sedeActualId) ?? sedes[0];
  // Solo el administrador cambia de sede: el supervisor opera en la suya (la base lo exige).
  const puedeCambiar = useAppStore((s) => s.usuarioActual?.rol === "administrador") && sedes.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={!puedeCambiar}
          aria-label={`Sede: ${sedeActual?.nombre ?? "Sin sede configurada"}`}
          className="flex items-center gap-2 rounded-lg px-2 py-2 pointer-coarse:min-h-11 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy-900 disabled:cursor-default disabled:hover:bg-transparent disabled:hover:text-slate-600 sm:px-3"
        >
          <Building2 aria-hidden className="size-4 text-slate-400" strokeWidth={1.75} />
          <span className="hidden max-w-40 truncate sm:inline">{sedeActual?.nombre ?? "Sin sede configurada"}</span>
          {puedeCambiar ? <ChevronDown aria-hidden className="size-3.5 text-slate-400" /> : null}
        </button>
      </DropdownMenuTrigger>
      {puedeCambiar ? (
        <DropdownMenuContent align="start">
          {sedes.map((sede) => (
            <DropdownMenuItem key={sede.id} onSelect={() => setSedeActual(sede.id)}>
              {sede.nombre}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  );
}
