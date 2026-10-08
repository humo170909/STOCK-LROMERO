"use client";

import { Menu, Search } from "lucide-react";
import { SedeSelector } from "./sede-selector";
import { UserMenu } from "./user-menu";

export function Topbar({ onOpenMenu, onOpenSearch }: { onOpenMenu: () => void; onOpenSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur desk:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir navegación"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 desk:hidden"
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.75} />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-brand-500 sm:max-w-80"
      >
        <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
        <span className="truncate">Buscar…</span>
        <span className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-400 sm:flex">
          Ctrl K
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1.5 desk:gap-2.5">
        <SedeSelector />
        <UserMenu />
      </div>
    </header>
  );
}
