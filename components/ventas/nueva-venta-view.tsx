"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { ventasService } from "@/services";
import type { Cliente, DetalleVenta, PagoVenta, Venta } from "@/types";
import { CustomerPicker } from "./customer-picker";
import { ProductSearch } from "./product-search";
import { CartTable } from "./cart-table";
import { OrderSummary } from "./order-summary";
import { ReceiptDialog } from "./receipt-dialog";
import { useCart } from "./use-cart";
import { usePagos } from "./use-pagos";

export function NuevaVentaView() {
  const cart = useCart();
  const pagos = usePagos(cart.totales.total);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const enviandoRef = useRef(false);
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [recibo, setRecibo] = useState<{ venta: Venta; detalle: DetalleVenta[]; cliente: Cliente; pagos: PagoVenta[] } | null>(null);

  // null = aún no se sabe (o no se pudo consultar): en ese caso no se bloquea y decide la base de datos.
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const sedeActualId = useAppStore((s) => s.sedeActualId);

  useEffect(() => {
    let vigente = true;
    ventasService
      .hayCajaAbierta()
      .then((abierta) => {
        if (vigente) setCajaAbierta(abierta);
      })
      .catch(() => {
        if (vigente) setCajaAbierta(null);
      });
    return () => {
      vigente = false;
    };
  }, [sedeActualId, recibo?.venta.id]);

  const confirmar = async () => {
    if (!cliente || cart.items.length === 0 || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const venta = await ventasService.confirmarVenta({
        clienteId: cliente.id,
        medioPago: pagos.medioPago,
        pagos: pagos.pagos,
        observaciones: observaciones.trim() || undefined,
        lineas: cart.items.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad, descuento: i.descuento })),
      });

      const detalle: DetalleVenta[] = cart.items.map((i, index) => ({
        id: `preview-${index}`,
        ventaId: venta.id,
        productoId: i.producto.id,
        nombreProducto: i.producto.nombre,
        cantidad: i.cantidad,
        precioHistorico: i.producto.precioVenta,
        costoHistorico: i.producto.costo,
        descuento: i.descuento,
        subtotal: i.producto.precioVenta * i.cantidad - i.descuento,
        ganancia: i.producto.precioVenta * i.cantidad - i.descuento - i.producto.costo * i.cantidad,
      }));

      setRecibo({ venta, detalle, cliente, pagos: pagos.pagos ?? [] });
    } catch (error) {
      toast.error("No se pudo registrar la venta", {
        description:
          error instanceof Error
            ? error.message
            : "Verifique el stock disponible e inténtelo nuevamente.",
      });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const nuevaVenta = () => {
    setRecibo(null);
    cart.vaciar();
    setCliente(null);
    setObservaciones("");
    pagos.reset();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy-900">Nueva venta</h1>
        <p className="text-sm text-slate-500">Registra una venta: cliente, productos y medio de pago.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 desk:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <CustomerPicker cliente={cliente} onSeleccionar={setCliente} onQuitar={() => setCliente(null)} />

          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProductSearch onSelect={cart.agregar} />
              <CartTable
                items={cart.items}
                onCantidadChange={cart.actualizarCantidad}
                onDescuentoChange={cart.actualizarDescuento}
                onQuitar={cart.quitar}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <OrderSummary
            totales={cart.totales}
            pagos={pagos}
            observaciones={observaciones}
            cliente={cliente}
            itemsCount={cart.items.length}
            enviando={enviando}
            cajaCerrada={cajaAbierta === false}
            onObservacionesChange={setObservaciones}
            onConfirmar={confirmar}
          />
        </div>
      </div>

      <ReceiptDialog
        venta={recibo?.venta ?? null}
        detalle={recibo?.detalle ?? []}
        cliente={recibo?.cliente ?? null}
        pagos={recibo?.pagos ?? []}
        onClose={nuevaVenta}
      />
    </div>
  );
}
