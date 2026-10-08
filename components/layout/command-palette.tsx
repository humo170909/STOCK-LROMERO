"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Command } from "cmdk";
import { Building2, FileText, Package, Receipt, Search, Truck, Users } from "lucide-react";
import {
  clientesService,
  comprasService,
  cotizacionesService,
  productosService,
  proveedoresService,
  ventasService,
} from "@/services";
import type { Cliente, Compra, Cotizacion, Producto, Proveedor, Venta } from "@/types";

type Resultado = {
  id: string;
  titulo: string;
  subtitulo: string;
  modulo: string;
  href: string;
  icon: typeof Package;
};

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);

  const cargadoEn = useRef(0);

  useEffect(() => {
    if (!open) return;
    // No se vuelve a descargar todo si se abrió hace menos de un minuto.
    if (Date.now() - cargadoEn.current < 60_000) return;
    let vigente = true;
    const lista = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
    Promise.allSettled([
      productosService.listarProductos(),
      clientesService.listarClientes(),
      ventasService.listarVentas(),
      cotizacionesService.listarCotizaciones(),
      comprasService.listarCompras(),
      proveedoresService.listarProveedores(),
    ]).then(([p, c, v, cot, comp, prov]) => {
      if (!vigente) return;
      cargadoEn.current = Date.now();
      setProductos(lista(p));
      setClientes(lista(c));
      setVentas(lista(v));
      setCotizaciones(lista(cot));
      setCompras(lista(comp));
      setProveedores(lista(prov));
    });
    return () => {
      vigente = false;
    };
  }, [open]);

  const resultados = useMemo<Resultado[]>(() => {
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));
    const proveedorPorId = new Map(proveedores.map((p) => [p.id, p]));
    return [
      ...productos.map((p) => ({
        id: p.id,
        titulo: p.nombre,
        subtitulo: `${p.sku} · Productos y stock`,
        modulo: "Productos",
        href: "/productos",
        icon: Package,
      })),
      ...clientes.map((c) => ({
        id: c.id,
        titulo: c.nombre,
        subtitulo: `${c.documento} · Clientes`,
        modulo: "Clientes",
        href: "/clientes",
        icon: Users,
      })),
      ...ventas.map((v) => ({
        id: v.id,
        titulo: v.numero,
        subtitulo: `${clientePorId.get(v.clienteId)?.nombre ?? "Cliente"} · Ventas`,
        modulo: "Ventas",
        href: "/ventas",
        icon: Receipt,
      })),
      ...cotizaciones.map((c) => ({
        id: c.id,
        titulo: c.numero,
        subtitulo: `${clientePorId.get(c.clienteId)?.nombre ?? "Cliente"} · Cotizaciones`,
        modulo: "Cotizaciones",
        href: "/cotizaciones",
        icon: FileText,
      })),
      ...compras.map((c) => ({
        id: c.id,
        titulo: c.numeroDocumento,
        subtitulo: `${proveedorPorId.get(c.proveedorId)?.razonSocial ?? "Proveedor"} · Compras`,
        modulo: "Compras",
        href: "/compras",
        icon: Truck,
      })),
      ...proveedores.map((p) => ({
        id: p.id,
        titulo: p.razonSocial,
        subtitulo: `${p.documento} · Proveedores`,
        modulo: "Proveedores",
        href: "/proveedores",
        icon: Building2,
      })),
    ];
  }, [productos, clientes, ventas, cotizaciones, compras, proveedores]);

  const grupos = useMemo(() => {
    const porModulo = new Map<string, Resultado[]>();
    for (const r of resultados) {
      porModulo.set(r.modulo, [...(porModulo.get(r.modulo) ?? []), r]);
    }
    return porModulo;
  }, [resultados]);

  const ir = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy-950/30" />
        <Dialog.Content className="fixed left-1/2 top-[14%] z-50 w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_-16px_rgb(15_28_51/0.35)] outline-none">
          <VisuallyHidden asChild>
            <Dialog.Title>Buscar en la plataforma</Dialog.Title>
          </VisuallyHidden>
          <Command label="Buscar" className="flex max-h-[70vh] flex-col" shouldFilter>
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4">
              <Search aria-hidden className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
              <Command.Input
                autoFocus
                placeholder="Buscar productos, clientes, ventas, cotizaciones, compras o proveedores…"
                className="h-13 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <Command.List className="thin-scroll overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-slate-500">
                Sin resultados. Intenta con otro término.
              </Command.Empty>
              {[...grupos.entries()].map(([modulo, items]) => (
                <Command.Group
                  key={modulo}
                  heading={modulo}
                  className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-400"
                >
                  {items.slice(0, 5).map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.titulo} ${item.subtitulo}`}
                      onSelect={() => ir(item.href)}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm text-slate-700 data-[selected=true]:bg-blue-50 data-[selected=true]:text-navy-900"
                    >
                      <item.icon
                        aria-hidden
                        className="size-4 shrink-0 text-slate-400 group-data-[selected=true]:text-brand-600"
                        strokeWidth={1.75}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{item.titulo}</span>
                        <span className="truncate text-xs text-slate-500 group-data-[selected=true]:text-brand-600">
                          {item.subtitulo}
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
