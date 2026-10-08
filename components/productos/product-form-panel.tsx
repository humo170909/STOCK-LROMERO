"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { SidePanel } from "@/components/shared/side-panel";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { productosService } from "@/services";
import type { Producto } from "@/types";

const schema = z.object({
  sku: z.string().trim().min(2, "Ingresa un SKU."),
  codigoBarras: z.string().trim(),
  nombre: z.string().trim().min(3, "Ingresa el nombre del producto."),
  descripcion: z.string().trim(),
  especificacionTecnica: z.string().trim().optional(),
  categoria: z.string().trim().min(2, "Ingresa una categoría."),
  marca: z.string().trim().min(1, "Ingresa una marca."),
  precioVenta: z.coerce.number().positive("El precio debe ser mayor a 0."),
  costo: z.coerce.number().nonnegative("El costo no puede ser negativo."),
  stockMinimo: z.coerce.number().int().nonnegative("El mínimo no puede ser negativo."),
  unidad: z.string().trim().min(1, "Ingresa la unidad."),
});

// z.coerce acepta "unknown" como tipo de entrada; FormInput es lo que maneja el formulario
// (antes de coercionar) y FormOutput es lo que recibe onSubmit (ya validado y coercionado).
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const VALORES_VACIOS: FormInput = {
  sku: "",
  codigoBarras: "",
  nombre: "",
  descripcion: "",
  especificacionTecnica: "",
  categoria: "",
  marca: "",
  precioVenta: 0,
  costo: 0,
  stockMinimo: 1,
  unidad: "unidad",
};

export function ProductFormPanel({
  open,
  producto,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  producto: Producto | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const sedeActualId = useAppStore((s) => s.sedeActualId);
  const [enviando, setEnviando] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: VALORES_VACIOS });

  useEffect(() => {
    if (!open) return;
    reset(
      producto
        ? {
            sku: producto.sku,
            codigoBarras: producto.codigoBarras,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            especificacionTecnica: producto.especificacionTecnica ?? "",
            categoria: producto.categoria,
            marca: producto.marca,
            precioVenta: producto.precioVenta,
            costo: producto.costo,
            stockMinimo: producto.stockMinimo,
            unidad: producto.unidad,
          }
        : VALORES_VACIOS,
    );
  }, [open, producto, reset]);

  const precioVenta = Number(useWatch({ control, name: "precioVenta" })) || 0;
  const costo = Number(useWatch({ control, name: "costo" })) || 0;
  const margen = precioVenta > 0 ? ((precioVenta - costo) / precioVenta) * 100 : 0;

  const onSubmit = async (values: FormOutput) => {
    setEnviando(true);
    try {
      await productosService.guardarProducto({
        id: producto?.id ?? "",
        ...values,
        activo: producto?.activo ?? true,
        sedeId: producto?.sedeId ?? sedeActualId,
      });
      toast.success(producto ? "Producto actualizado" : "Producto creado", { description: values.nombre });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error("No se pudo guardar el producto", {
        description: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={producto ? "Editar producto" : "Nuevo producto"}
      description={producto ? `${producto.sku}` : "Se agrega al catálogo de la sede actual."}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="SKU" htmlFor="sku" error={errors.sku?.message}>
              <Input id="sku" {...register("sku")} />
            </Field>
            <Field label="Código de barras" htmlFor="codigoBarras" error={errors.codigoBarras?.message}>
              <Input id="codigoBarras" {...register("codigoBarras")} />
            </Field>
          </div>

          <Field label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
            <Input id="nombre" {...register("nombre")} />
          </Field>

          <Field label="Descripción" htmlFor="descripcion" error={errors.descripcion?.message}>
            <Textarea id="descripcion" rows={2} {...register("descripcion")} />
          </Field>

          <Field label="Especificación técnica (opcional)" htmlFor="especificacion">
            <Textarea id="especificacion" rows={2} {...register("especificacionTecnica")} />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Categoría" htmlFor="categoria" error={errors.categoria?.message}>
              <Input id="categoria" {...register("categoria")} />
            </Field>
            <Field label="Marca" htmlFor="marca" error={errors.marca?.message}>
              <Input id="marca" {...register("marca")} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Precio de venta (S/)" htmlFor="precioVenta" error={errors.precioVenta?.message}>
              <Input id="precioVenta" type="number" step="0.01" {...register("precioVenta")} />
            </Field>
            <Field label="Costo (S/)" htmlFor="costo" error={errors.costo?.message}>
              <Input
                id="costo"
                type="number"
                step="0.01"
                readOnly={!!producto && producto.stockActual > 0}
                title={producto && producto.stockActual > 0 ? "Con stock, el costo lo calcula el promedio de las compras." : undefined}
                {...register("costo")}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
            <span className="text-[13px] text-slate-500">Margen estimado</span>
            <span className="text-sm font-semibold text-navy-900">{margen.toFixed(1)}%</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Stock mínimo" htmlFor="stockMinimo" error={errors.stockMinimo?.message}>
              <Input id="stockMinimo" type="number" step="1" {...register("stockMinimo")} />
            </Field>
            <Field label="Unidad" htmlFor="unidad" error={errors.unidad?.message}>
              <Input id="unidad" {...register("unidad")} />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Guardando…" : producto ? "Guardar cambios" : "Crear producto"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
