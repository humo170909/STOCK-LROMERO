"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-navy-900">Algo salió mal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ocurrió un error inesperado. Inténtalo de nuevo; si continúa, avisa al administrador.
        </p>
        <Button className="mt-5" onClick={() => reset()}>
          Reintentar
        </Button>
      </div>
    </main>
  );
}
