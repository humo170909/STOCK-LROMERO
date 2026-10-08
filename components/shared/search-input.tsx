"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
  delay = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const [texto, setTexto] = useState(value);
  const [valorSincronizado, setValorSincronizado] = useState(value);
  const emitir = useDebouncedCallback(onChange, delay);

  // Si el valor externo cambia (p. ej. se limpiaron los filtros), se refleja sin useEffect.
  if (value !== valorSincronizado) {
    setValorSincronizado(value);
    setTexto(value);
  }

  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-within:border-brand-500",
        className,
      )}
    >
      <Search aria-hidden className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
      <input
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          emitir(e.target.value);
        }}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
      />
      {texto ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            setTexto("");
            onChange("");
          }}
          className="grid size-5 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
