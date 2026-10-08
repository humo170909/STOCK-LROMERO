"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "@/app/login/actions";
import { tienePermiso, useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { navGroups, type NavItem } from "./nav-config";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const limpiarSesion = useAppStore((s) => s.limpiarSesion);
  const [saliendo, startSalir] = useTransition();
  const rol = useAppStore((s) => s.usuarioActual?.rol);
  const sesionCargada = useAppStore((s) => s.sesionCargada);
  const permisos = useAppStore((s) => s.permisos);

  // La sección de administrador no existe para otros roles ni mientras la sesión carga.
  const visible = (item: NavItem) => {
    if (item.soloAdmin) return sesionCargada && rol === "administrador";
    if (!item.modulo || !sesionCargada) return true;
    return tienePermiso(permisos, item.modulo, item.accion ?? "ver");
  };
  const gruposVisibles = navGroups
    .map((g) => ({ ...g, items: g.items.filter(visible) }))
    .filter((g) => g.items.length > 0);

  const salir = () => {
    startSalir(async () => {
      await cerrarSesion();
      limpiarSesion();
      router.push("/login");
      router.refresh();
    });
  };

  // Solo un ítem activo: el href más largo que coincide (así /ventas/nueva no enciende también /ventas).
  const hrefActivo = gruposVisibles
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[13px] font-bold tracking-tight text-white"
        >
          LR
        </span>
        <span className="truncate text-sm font-semibold tracking-tight text-navy-900">
          Grupo LRomero
        </span>
      </div>

      <nav className="thin-scroll flex-1 overflow-y-auto px-3 pb-4">
        {gruposVisibles.map((grupo) => (
          <div key={grupo.titulo} className="mb-4">
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {grupo.titulo}
            </p>
            <ul role="list" className="space-y-0.5">
              {grupo.items.map((item) => {
                const activo = item.href === hrefActivo;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 pointer-coarse:min-h-11 text-[13.5px] font-medium transition-colors",
                        activo
                          ? "bg-blue-50 text-navy-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-navy-900",
                      )}
                    >
                      <Icon aria-hidden className={cn("size-[18px] shrink-0", activo ? "text-brand-600" : "text-slate-400")} strokeWidth={1.75} />
                      <span className="truncate">{item.label}</span>
                      {!item.listo ? (
                        <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          pronto
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-100 px-3 py-3">
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 pointer-coarse:min-h-11 text-[13.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-danger-500 disabled:opacity-60"
        >
          <LogOut aria-hidden className="size-[18px] shrink-0 text-slate-400" strokeWidth={1.75} />
          {saliendo ? "Saliendo…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white desk:block">
      <div className="fixed inset-y-0 left-0 w-64">
        <SidebarContent />
      </div>
    </aside>
  );
}
