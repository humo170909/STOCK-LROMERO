export type ModuloSistema =
  | "ventas"
  | "cotizaciones"
  | "productos"
  | "inventario"
  | "movimientos"
  | "compras"
  | "proveedores"
  | "clientes"
  | "caja"
  | "trabajadores"
  | "reportes"
  | "auditoria"
  | "usuarios"
  | "configuracion";

export type AccionPermiso = "ver" | "crear" | "editar" | "eliminar" | "aprobar" | "cancelar" | "exportar";

/** Permisos de un rol por módulo y acción, tal como están en la base (rol_permisos).
 * La seguridad real la aplican RLS y las funciones de la base; la interfaz solo los refleja. */
export type PermisosRol = Record<ModuloSistema, Record<AccionPermiso, boolean>>;

export type Sede = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  activa: boolean;
};

export type ConfiguracionEmpresa = {
  nombre: string;
  razonSocial: string;
  documento: string;
  direccion: string;
  telefono: string;
  correo: string;
  logoUrl: string;
  moneda: "PEN";
  /** Impuesto / cargo opcional como fracción (0.05 = 5 %). 0 = sin impuesto (valor por defecto). */
  impuesto: number;
};

export type TipoNotificacion =
  | "stock_critico"
  | "producto_agotado"
  | "operacion_pendiente"
  | "caja_pendiente"
  | "cotizacion_por_vencer"
  | "alerta_administrativa";

export type Notificacion = {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  enlace?: string;
};

export type ModuloAuditoria =
  | "sesion"
  | "ventas"
  | "productos"
  | "inventario"
  | "compras"
  | "precios"
  | "permisos"
  | "configuracion"
  | "caja"
  | "clientes"
  | "proveedores"
  | "trabajadores";

export type RegistroAuditoria = {
  id: string;
  usuarioId: string;
  accion: string;
  modulo: ModuloAuditoria;
  fecha: string;
  registroAfectadoId?: string;
  resultado: "exito" | "error";
  detalle?: string;
};
