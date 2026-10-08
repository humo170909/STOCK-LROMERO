"use client";

import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Paneles con más contenido (p. ej. un expediente con historial) piden más ancho. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-navy-950/30" />
        <Drawer.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-white outline-none",
            wide ? "max-w-2xl" : "max-w-md",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <Drawer.Title className="text-base font-semibold text-navy-900">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-0.5 text-sm text-slate-500">{description}</Drawer.Description>
              ) : null}
            </div>
            <Drawer.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X aria-hidden className="size-4" strokeWidth={1.75} />
              </button>
            </Drawer.Close>
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
