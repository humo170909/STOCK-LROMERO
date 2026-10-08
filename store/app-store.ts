"use client";

// Estado global del cliente. Los datos de negocio (productos, ventas, clientes, caja…)
// NO viven aquí: se leen y escriben contra Supabase desde /services/supabase. Este store
// solo guarda lo que toda la interfaz necesita al instante: sesión, empresa, sedes,
// medios de pago y notificaciones.
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type {
  Cliente,
  ConfiguracionEmpresa,
  MedioPago,
  PagoVenta,
  Notificacion,
  Producto,
  Proveedor,
  RolUsuario,
  Sede,
  Trabajador,
  Usuario,
} from "@/types";

// --- Payloads que comparten servicios y pantallas ------------------------------------

export type AjusteStockPayload = {
  productoId: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  motivo: string;
  documentoSustento?: string;
  observaciones?: string;
};

export type GuardarProductoPayload = Omit<Producto, "creadoEn" | "stockActual"> & {
  stockActual?: number;
};

export type LineaCarrito = {
  productoId: string;
  cantidad: number;
  descuento: number;
};

export type ConfirmarVentaPayload = {
  clienteId: string;
  lineas: LineaCarrito[];
  medioPago: MedioPago;
  /** Solo si se paga con más de un medio; la suma debe ser igual al total. */
  pagos?: PagoVenta[];
  observaciones?: string;
};

export type RegistrarClienteRapidoPayload = {
  documento: string;
  nombre: string;
  telefono?: string;
  direccion?: string;
};

export type GuardarClientePayload = Omit<Cliente, "registradoEn" | "activo"> & {
  activo?: boolean;
};

export type MovimientoManualPayload = {
  tipo: "ingreso_manual" | "egreso_manual";
  medioPago: MedioPago;
  monto: number;
  concepto: string;
};

export type LineaCompra = {
  productoId: string;
  cantidad: number;
  costoUnitario: number;
};

export type RegistrarCompraPayload = {
  proveedorId: string;
  numeroDocumento: string;
  lineas: LineaCompra[];
  observaciones?: string;
};

export type GuardarProveedorPayload = Omit<Proveedor, "activo"> & {
  activo?: boolean;
};

export type LineaCotizacion = {
  productoId: string;
  cantidad: number;
  descuento: number;
};

export type CrearCotizacionPayload = {
  clienteId: string;
  lineas: LineaCotizacion[];
  fechaVencimiento: string;
  condiciones?: string;
};

export type ConvertirCotizacionPayload = {
  cotizacionId: string;
  medioPago: MedioPago;
  pagos?: PagoVenta[];
};

export type GuardarTrabajadorPayload = Omit<Trabajador, "activo"> & {
  activo?: boolean;
};

export type GuardarUsuarioPayload = Omit<Usuario, "activo"> & {
  activo?: boolean;
};

export type GuardarSedePayload = Omit<Sede, "activa"> & {
  activa?: boolean;
};

// --- Estado --------------------------------------------------------------------------

const MEDIOS_PAGO_POR_DEFECTO: MedioPago[] = ["efectivo", "yape", "plin", "transferencia", "tarjeta"];

// Sin facturación electrónica ni IGV: el impuesto es un cargo opcional y queda en 0.
const CONFIGURACION_EMPRESA_VACIA: ConfiguracionEmpresa = {
  nombre: "",
  razonSocial: "",
  documento: "",
  direccion: "",
  telefono: "",
  correo: "",
  logoUrl: "/logo.png",
  moneda: "PEN",
  impuesto: 0,
};

type EstadoEmpresa = "cargando" | "ok" | "sin_empresa_asignada" | "empresa_no_encontrada" | "error";

type AppState = {
  sedes: Sede[];
  sedeActualId: string;
  usuarioActual: Usuario | null;
  sesionCargada: boolean;
  estadoEmpresa: EstadoEmpresa;
  configuracionEmpresa: ConfiguracionEmpresa;
  mediosPagoActivos: MedioPago[];
  notificaciones: Notificacion[];
  /** Permisos del rol del usuario, como "modulo.accion" (p. ej. "ventas.cancelar"). */
  permisos: string[];
  setSedeActual: (sedeId: string) => void;
  marcarNotificacionLeida: (id: string) => void;
  /** Lee usuario, empresa y sedes desde Supabase. También sirve para refrescar tras un cambio. */
  cargarSesionReal: () => Promise<void>;
  /** Limpia todo al cerrar sesión. */
  limpiarSesion: () => void;
};

const ESTADO_INICIAL = {
  sedes: [] as Sede[],
  sedeActualId: "",
  usuarioActual: null as Usuario | null,
  sesionCargada: false,
  estadoEmpresa: "cargando" as EstadoEmpresa,
  configuracionEmpresa: CONFIGURACION_EMPRESA_VACIA,
  mediosPagoActivos: MEDIOS_PAGO_POR_DEFECTO,
  notificaciones: [] as Notificacion[],
  permisos: [] as string[],
};

export const useAppStore = create<AppState>((set, get) => ({
  ...ESTADO_INICIAL,

  setSedeActual: (sedeId) => set({ sedeActualId: sedeId }),

  marcarNotificacionLeida: (id) =>
    set((state) => ({
      notificaciones: state.notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    })),

  limpiarSesion: () => set({ ...ESTADO_INICIAL, sesionCargada: true }),

  cargarSesionReal: async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        set({ sesionCargada: true, estadoEmpresa: "error" });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, nombre, sede_id, empresa_id, rol_id, activo")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || !profile.empresa_id) {
        set({ sesionCargada: true, estadoEmpresa: "sin_empresa_asignada" });
        return;
      }

      // Usuario desactivado: se cierra la sesión y vuelve al login.
      if (!profile.activo) {
        await supabase.auth.signOut();
        set({ ...ESTADO_INICIAL, sesionCargada: true, estadoEmpresa: "error" });
        if (typeof window !== "undefined") window.location.replace("/login");
        return;
      }

      // profile.rol_id puede ser null (perfil incompleto). Sin esta guarda, `.eq("id", null)`
      // viajaría al backend como el texto "null" y Postgres respondería 400 en vez de "sin rol".
      const [{ data: rol }, { data: empresaRow }, { data: sedesRows }, { data: rolPermisosRows }, { data: permisosRows }] = await Promise.all([
        profile.rol_id
          ? supabase.from("roles").select("codigo").eq("id", profile.rol_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("empresas").select("*").eq("id", profile.empresa_id).maybeSingle(),
        supabase.from("sedes").select("*").eq("empresa_id", profile.empresa_id).eq("estado", true).order("nombre"),
        profile.rol_id
          ? supabase.from("rol_permisos").select("permiso_id").eq("rol_id", profile.rol_id)
          : Promise.resolve({ data: [] as { permiso_id: string }[] }),
        supabase.from("permisos").select("id, modulo, accion"),
      ]);

      const permisoPorId = new Map((permisosRows ?? []).map((p) => [p.id, p.modulo + "." + p.accion]));
      const permisos = (rolPermisosRows ?? []).map((rp) => permisoPorId.get(rp.permiso_id)).filter((p): p is string => !!p);

      const usuarioReal: Usuario = {
        id: user.id,
        nombre: profile.nombre,
        usuario: user.email ?? "",
        rol: (rol?.codigo ?? "supervisor") as RolUsuario,
        activo: profile.activo,
      };

      const sedes: Sede[] = (sedesRows ?? []).map((s) => ({
        id: s.id,
        nombre: s.nombre,
        direccion: s.direccion ?? "",
        telefono: s.telefono ?? "",
        activa: s.estado,
      }));

      // Si ya había una sede elegida y sigue existiendo, se respeta; si no, la del perfil.
      const actual = get().sedeActualId;
      const sedeActualId = sedes.some((s) => s.id === actual) ? actual : (profile.sede_id ?? sedes[0]?.id ?? "");

      const guardados = (empresaRow?.configuracion as { mediosPagoActivos?: MedioPago[] } | null)?.mediosPagoActivos;

      set({
        usuarioActual: usuarioReal,
        permisos,
        sedes,
        sedeActualId,
        configuracionEmpresa: empresaRow
          ? {
              nombre: empresaRow.nombre,
              razonSocial: empresaRow.razon_social,
              documento: empresaRow.documento ?? "",
              direccion: empresaRow.direccion ?? "",
              telefono: empresaRow.telefono ?? "",
              correo: empresaRow.correo ?? "",
              logoUrl: empresaRow.logo_url ?? "/logo.png",
              moneda: "PEN",
              impuesto: Number(empresaRow.impuesto),
            }
          : CONFIGURACION_EMPRESA_VACIA,
        mediosPagoActivos: guardados && guardados.length > 0 ? guardados : MEDIOS_PAGO_POR_DEFECTO,
        sesionCargada: true,
        estadoEmpresa: empresaRow ? "ok" : "empresa_no_encontrada",
      });
    } catch (error) {
      console.error("No se pudo cargar la sesión:", error);
      set({ sesionCargada: true, estadoEmpresa: "error" });
    }
  },
}));

/** ¿El usuario actual tiene este permiso? Solo sirve para mostrar u ocultar opciones;
 * la seguridad real la aplica la base de datos. */
export function tienePermiso(permisos: string[], modulo: string, accion = "ver") {
  return permisos.includes(`${modulo}.${accion}`);
}
