"use client";

import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { CircleCheck, Search, UserPlus, UserRound, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ventasService } from "@/services";
import type { Cliente } from "@/types";

type Pestana = "buscar" | "nuevo";

export function CustomerPicker({
  cliente,
  onSeleccionar,
  onQuitar,
}: {
  cliente: Cliente | null;
  onSeleccionar: (cliente: Cliente) => void;
  onQuitar: () => void;
}) {
  const [pestana, setPestana] = useState<Pestana>("buscar");
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [registrando, setRegistrando] = useState(false);

  const [textoBuscado] = useDebounce(texto, 250);

  useEffect(() => {
    let vigente = true;
    if (textoBuscado.trim().length < 2) return;
    ventasService
      .buscarClientes(textoBuscado)
      .then((lista) => {
        if (vigente) setResultados(lista);
      })
      .catch(() => {
        if (vigente) setResultados([]);
      });
    return () => {
      vigente = false;
    };
  }, [textoBuscado]);

  // Con menos de 2 letras no se muestran resultados viejos.
  const visibles = texto.trim().length < 2 ? [] : resultados;

  const registrarYUsar = async () => {
    if (nombre.trim().length < 2) {
      toast.error("Ingresa el nombre del cliente.");
      return;
    }
    setRegistrando(true);
    try {
      const nuevo = await ventasService.registrarClienteRapido({
        documento: documento.trim(),
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
      });
      onSeleccionar(nuevo);
      toast.success("Cliente registrado", { description: nuevo.nombre });
    } catch (error) {
      toast.error("No se pudo registrar el cliente", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setRegistrando(false);
    }
  };

  if (cliente) {
    return (
      <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-brand-600">
            <CircleCheck className="size-4.5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-navy-900">{cliente.nombre}</p>
            {cliente.documento ? <p className="text-xs text-slate-500">{cliente.documento}</p> : null}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onQuitar}>
          <X className="size-3.5" />
          Cambiar
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setPestana("buscar")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium",
            pestana === "buscar" ? "bg-white text-navy-900 shadow-sm" : "text-slate-500",
          )}
        >
          Buscar cliente
        </button>
        <button
          type="button"
          onClick={() => setPestana("nuevo")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-[13px] font-medium",
            pestana === "nuevo" ? "bg-white text-navy-900 shadow-sm" : "text-slate-500",
          )}
        >
          Registrar cliente nuevo
        </button>
      </div>

      {pestana === "buscar" ? (
        <div>
          <div className="flex h-10 pointer-coarse:h-11 items-center gap-2 rounded-lg border border-slate-200 px-3">
            <Search className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Nombre o documento…"
              aria-label="Buscar cliente por nombre o documento"
              className="h-full min-w-0 flex-1 bg-transparent text-sm pointer-coarse:text-base outline-none placeholder:text-slate-400"
            />
          </div>
          {visibles.length > 0 ? (
            <ul role="list" className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
              {visibles.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSeleccionar(c)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-blue-50"
                  >
                    <UserRound className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-navy-900">{c.nombre}</span>
                      {c.documento ? <span className="block text-xs text-slate-500">{c.documento}</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" />
          <div className="flex gap-2">
            <Input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="Documento (opcional)"
              className="flex-1"
            />
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono (opcional)"
              className="flex-1"
            />
          </div>
          <Button type="button" size="sm" onClick={registrarYUsar} disabled={registrando}>
            <UserPlus className="size-4" strokeWidth={1.75} />
            {registrando ? "Registrando…" : "Registrar y usar este cliente"}
          </Button>
        </div>
      )}
    </Card>
  );
}
