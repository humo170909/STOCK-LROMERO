"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { CommandPalette } from "./command-palette";
import { MobileSidebar } from "./mobile-sidebar";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const sedeActualId = useAppStore((s) => s.sedeActualId);

  useEffect(() => {
    useAppStore.getState().cargarSesionReal();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setBuscadorAbierto((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh bg-slate-50">
      <Sidebar />
      <MobileSidebar open={menuAbierto} onOpenChange={setMenuAbierto} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setMenuAbierto(true)} onOpenSearch={() => setBuscadorAbierto(true)} />
        {/* key: al cambiar de sede la pantalla se reinicia y vuelve a cargar sus datos. */}
        <main key={sedeActualId} className="flex-1 px-4 py-5 desk:px-6 desk:py-6">
          {children}
        </main>
      </div>
      <CommandPalette open={buscadorAbierto} onOpenChange={setBuscadorAbierto} />
    </div>
  );
}
