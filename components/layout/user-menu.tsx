"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut, UserRound } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/app-store";

const ROL_LABEL: Record<string, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
};

export function UserMenu() {
  const usuario = useAppStore((s) => s.usuarioActual);
  const limpiarSesion = useAppStore((s) => s.limpiarSesion);
  const router = useRouter();
  const [saliendo, startSalir] = useTransition();

  const salir = () => {
    startSalir(async () => {
      await cerrarSesion();
      limpiarSesion();
      router.push("/login");
      router.refresh();
    });
  };

  if (!usuario) {
    return <span className="size-9 shrink-0 rounded-full bg-slate-100" aria-hidden />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg py-1 pl-1.5 pr-2.5 pointer-coarse:min-h-11 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white">
            {usuario.nombre
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase()}
          </span>
          <span className="hidden flex-col text-left desk:flex">
            <span className="text-[13px] font-medium leading-tight text-navy-900">{usuario.nombre}</span>
            <span className="text-[11px] leading-tight text-slate-500">{ROL_LABEL[usuario.rol]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          {usuario.nombre}
          <span className="block text-[11px] font-normal text-slate-400">{ROL_LABEL[usuario.rol]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="opacity-60">
          <UserRound aria-hidden className="size-4" strokeWidth={1.75} />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={salir} disabled={saliendo} className="text-danger-500 data-[highlighted]:bg-red-50 data-[highlighted]:text-danger-500">
          <LogOut aria-hidden className="size-4" strokeWidth={1.75} />
          {saliendo ? "Saliendo…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
