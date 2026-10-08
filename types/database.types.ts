// Tipos de la base de datos real (Supabase/PostgreSQL). Escritos a mano siguiendo
// exactamente el esquema de /supabase/migrations/*.sql. Cuando tengas un proyecto
// Supabase conectado, puedes regenerarlos con:
//   npx supabase gen types typescript --project-id <id> > types/database.types.ts
// y deberían coincidir con esta forma si las migraciones no cambiaron.
//
// Nota: `Relationships` en cada tabla/view es un requisito estructural de
// @supabase/postgrest-js (GenericTable/GenericView) para poder tipar los
// joins embebidos (`.select("*, categorias(nombre)")`). Solo se listan las
// relaciones que de verdad se usan en algún `select` embebido de
// services/supabase/**; el resto queda como array vacío — no afecta en nada
// a runtime, solo a cuántos joins puede tipar el compilador.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RiesgoCliente = "bajo" | "medio" | "alto";
export type EstadoVenta = "confirmada" | "anulada";
export type MedioPago = "efectivo" | "yape" | "plin" | "transferencia" | "tarjeta" | "otros";
export type EstadoCotizacion = "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida" | "convertida";
export type EstadoCompra = "registrada" | "anulada";
export type TipoMovimientoInventario = "entrada" | "salida" | "ajuste" | "compra" | "venta" | "devolucion" | "correccion";
export type EstadoCajaSesion = "abierta" | "cerrada";
export type TipoMovimientoCaja = "apertura" | "venta" | "ingreso" | "egreso" | "cierre" | "ajuste";
export type TipoNotificacion =
  | "stock_critico"
  | "producto_agotado"
  | "operacion_pendiente"
  | "caja_pendiente"
  | "cotizacion_por_vencer"
  | "alerta_administrativa";
export type RolCodigo = "administrador" | "supervisor";
export type ModuloPermiso =
  | "ventas" | "productos" | "inventario" | "compras" | "proveedores" | "clientes"
  | "cotizaciones" | "movimientos" | "caja" | "trabajadores" | "reportes" | "auditoria"
  | "usuarios" | "configuracion";
export type AccionPermiso = "ver" | "crear" | "editar" | "eliminar" | "aprobar" | "cancelar" | "exportar";

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string; nombre: string; razon_social: string; documento: string | null;
          direccion: string | null; telefono: string | null; correo: string | null;
          logo_url: string | null; moneda: string; impuesto: number; configuracion: Json;
          estado: boolean; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["empresas"]["Row"]> & { nombre: string; razon_social: string };
        Update: Partial<Database["public"]["Tables"]["empresas"]["Row"]>;
        Relationships: [];
      };
      sedes: {
        Row: {
          id: string; empresa_id: string; nombre: string; codigo: string;
          direccion: string | null; telefono: string | null; estado: boolean;
          created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sedes"]["Row"]> & { empresa_id: string; nombre: string; codigo: string };
        Update: Partial<Database["public"]["Tables"]["sedes"]["Row"]>;
        Relationships: [];
      };
      roles: {
        Row: { id: string; codigo: RolCodigo; nombre: string; descripcion: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["roles"]["Row"]> & { codigo: RolCodigo; nombre: string };
        Update: Partial<Database["public"]["Tables"]["roles"]["Row"]>;
        Relationships: [];
      };
      permisos: {
        Row: { id: string; modulo: ModuloPermiso; accion: AccionPermiso; descripcion: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["permisos"]["Row"]> & { modulo: ModuloPermiso; accion: AccionPermiso };
        Update: Partial<Database["public"]["Tables"]["permisos"]["Row"]>;
        Relationships: [];
      };
      rol_permisos: {
        Row: { rol_id: string; permiso_id: string };
        Insert: { rol_id: string; permiso_id: string };
        Update: Partial<{ rol_id: string; permiso_id: string }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string; empresa_id: string; sede_id: string | null; rol_id: string;
          nombre: string; documento: string | null; telefono: string | null;
          activo: boolean; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; empresa_id: string; rol_id: string; nombre: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      categorias: {
        Row: { id: string; empresa_id: string; nombre: string; descripcion: string | null; estado: boolean; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["categorias"]["Row"]> & { empresa_id: string; nombre: string };
        Update: Partial<Database["public"]["Tables"]["categorias"]["Row"]>;
        Relationships: [];
      };
      productos: {
        Row: {
          id: string; empresa_id: string; categoria_id: string | null; codigo: string;
          codigo_barras: string | null; nombre: string; descripcion: string | null;
          especificacion_tecnica: string | null; marca: string | null; unidad_medida: string;
          precio_venta: number; costo_actual: number; stock_minimo_default: number;
          estado: boolean; deleted_at: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["productos"]["Row"]> & { empresa_id: string; codigo: string; nombre: string; precio_venta: number };
        Update: Partial<Database["public"]["Tables"]["productos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias";
            referencedColumns: ["id"];
          },
        ];
      };
      inventario: {
        Row: {
          id: string; producto_id: string; sede_id: string; stock_actual: number;
          stock_minimo: number; costo_actual: number; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["inventario"]["Row"]> & { producto_id: string; sede_id: string };
        Update: Partial<Database["public"]["Tables"]["inventario"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "inventario_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventario_sede_id_fkey";
            columns: ["sede_id"];
            isOneToOne: false;
            referencedRelation: "sedes";
            referencedColumns: ["id"];
          },
        ];
      };
      movimientos_inventario: {
        Row: {
          id: string; empresa_id: string; sede_id: string; producto_id: string;
          tipo: TipoMovimientoInventario; cantidad: number; stock_anterior: number;
          stock_nuevo: number; motivo: string | null; referencia_tipo: string | null;
          referencia_id: string | null; documento_sustento: string | null;
          observaciones: string | null; usuario_id: string | null; created_at: string;
        };
        Insert: never; // solo vía RPC
        Update: never;
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          id: string; empresa_id: string; numero_documento: string | null;
          nombre: string; telefono: string | null; correo: string | null; direccion: string | null;
          linea_credito: number; riesgo: RiesgoCliente; estado: boolean; deleted_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clientes"]["Row"]> & { empresa_id: string; nombre: string };
        Update: Partial<Database["public"]["Tables"]["clientes"]["Row"]>;
        Relationships: [];
      };
      proveedores: {
        Row: {
          id: string; empresa_id: string; razon_social: string; documento: string | null;
          telefono: string | null; correo: string | null; direccion: string | null;
          contacto: string | null; observaciones: string | null; estado: boolean;
          deleted_at: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["proveedores"]["Row"]> & { empresa_id: string; razon_social: string };
        Update: Partial<Database["public"]["Tables"]["proveedores"]["Row"]>;
        Relationships: [];
      };
      ventas: {
        Row: {
          id: string; empresa_id: string; sede_id: string; cliente_id: string; usuario_id: string;
          numero: string; correlativo: number;
          fecha: string; subtotal: number; descuento: number; impuesto: number; total: number;
          costo_total: number; ganancia_total: number; medio_pago: MedioPago | "mixto"; estado: EstadoVenta;
          observaciones: string | null; created_at: string; updated_at: string;
        };
        Insert: never; // solo vía fn_registrar_venta
        Update: never;
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ventas_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      venta_detalles: {
        Row: {
          id: string; venta_id: string; producto_id: string; cantidad: number;
          precio_unitario: number; costo_unitario: number; descuento: number; impuesto: number;
          subtotal: number; costo_total: number; ganancia: number; created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "venta_detalles_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venta_detalles_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
        ];
      };
      venta_pagos: {
        Row: { id: string; venta_id: string; medio_pago: MedioPago; monto: number; created_at: string };
        Insert: never; // solo vía fn_registrar_venta
        Update: never;
        Relationships: [
          {
            foreignKeyName: "venta_pagos_venta_id_fkey";
            columns: ["venta_id"];
            isOneToOne: false;
            referencedRelation: "ventas";
            referencedColumns: ["id"];
          },
        ];
      };
      cotizaciones: {
        Row: {
          id: string; empresa_id: string; sede_id: string; cliente_id: string; usuario_id: string;
          numero: string; fecha_emision: string; fecha_vencimiento: string; condiciones: string | null;
          subtotal: number; descuento: number; impuesto: number; total: number;
          estado: EstadoCotizacion; venta_id: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cotizaciones"]["Row"]> & {
          empresa_id: string; sede_id: string; cliente_id: string; usuario_id: string;
          numero: string; fecha_vencimiento: string; subtotal: number; total: number;
        };
        Update: Partial<Database["public"]["Tables"]["cotizaciones"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      cotizacion_detalles: {
        Row: {
          id: string; cotizacion_id: string; producto_id: string; cantidad: number;
          precio_unitario: number; descuento: number; subtotal: number; created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["cotizacion_detalles"]["Row"]> & {
          cotizacion_id: string; producto_id: string; cantidad: number; precio_unitario: number;
        };
        Update: Partial<Database["public"]["Tables"]["cotizacion_detalles"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "cotizacion_detalles_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
        ];
      };
      compras: {
        Row: {
          id: string; empresa_id: string; sede_id: string; proveedor_id: string; usuario_id: string;
          numero_documento: string; fecha: string; subtotal: number; impuesto: number; total: number;
          estado: EstadoCompra; observaciones: string | null; created_at: string; updated_at: string;
        };
        Insert: never; // solo vía fn_registrar_compra
        Update: never;
        Relationships: [
          {
            foreignKeyName: "compras_proveedor_id_fkey";
            columns: ["proveedor_id"];
            isOneToOne: false;
            referencedRelation: "proveedores";
            referencedColumns: ["id"];
          },
        ];
      };
      compra_detalles: {
        Row: { id: string; compra_id: string; producto_id: string; cantidad: number; costo_unitario: number; subtotal: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "compra_detalles_producto_id_fkey";
            columns: ["producto_id"];
            isOneToOne: false;
            referencedRelation: "productos";
            referencedColumns: ["id"];
          },
        ];
      };
      cajas: {
        Row: { id: string; sede_id: string; nombre: string; estado: boolean; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["cajas"]["Row"]> & { sede_id: string };
        Update: Partial<Database["public"]["Tables"]["cajas"]["Row"]>;
        Relationships: [];
      };
      caja_sesiones: {
        Row: {
          id: string; caja_id: string; usuario_apertura_id: string; usuario_cierre_id: string | null;
          estado: EstadoCajaSesion; monto_apertura: number; monto_cierre_esperado: number | null;
          monto_cierre_real: number | null; diferencia: number | null; abierta_en: string; cerrada_en: string | null;
        };
        Insert: never; // solo vía fn_abrir_caja
        Update: never;
        Relationships: [];
      };
      movimientos_caja: {
        Row: {
          id: string; caja_sesion_id: string; sede_id: string; tipo: TipoMovimientoCaja;
          medio_pago: MedioPago; monto: number; concepto: string; referencia_tipo: string | null;
          referencia_id: string | null; usuario_id: string; created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      trabajadores: {
        Row: {
          id: string; empresa_id: string; sede_id: string; profile_id: string | null;
          nombre: string; documento: string; telefono: string | null; cargo: string;
          ingresado_en: string; estado: boolean; deleted_at: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["trabajadores"]["Row"]> & { empresa_id: string; sede_id: string; nombre: string; documento: string; cargo: string };
        Update: Partial<Database["public"]["Tables"]["trabajadores"]["Row"]>;
        Relationships: [];
      };
      notificaciones: {
        Row: {
          id: string; empresa_id: string; sede_id: string | null; usuario_id: string | null;
          tipo: TipoNotificacion; titulo: string; mensaje: string; leida: boolean;
          referencia_tipo: string | null; referencia_id: string | null; created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notificaciones"]["Row"]> & { empresa_id: string; tipo: TipoNotificacion; titulo: string; mensaje: string };
        Update: never; // usar fn_marcar_notificacion_leida
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string; usuario_id: string | null; empresa_id: string | null; sede_id: string | null;
          accion: string; modulo: string; tabla_afectada: string | null; registro_id: string | null;
          datos_anteriores: Json | null; datos_nuevos: Json | null; ip: string | null;
          user_agent: string | null; created_at: string;
        };
        Insert: never; // solo vía funciones SECURITY DEFINER
        Update: never;
        Relationships: [
          {
            foreignKeyName: "audit_logs_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      backups: {
        Row: {
          id: string; empresa_id: string; tipo: "manual" | "automatico"; formatos: string[];
          estado: "procesando" | "completado" | "error"; archivos: Json; tamano_bytes: number;
          resumen: Json | null; error_mensaje: string | null; creado_por: string | null;
          created_at: string; completed_at: string | null;
        };
        Insert: {
          empresa_id: string; tipo?: "manual" | "automatico"; formatos: string[];
          estado?: "procesando" | "completado" | "error"; creado_por?: string | null;
        };
        Update: {
          estado?: "procesando" | "completado" | "error"; archivos?: Json; tamano_bytes?: number;
          resumen?: Json | null; error_mensaje?: string | null; completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "backups_creado_por_fkey";
            columns: ["creado_por"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_stock_critico: {
        Row: {
          inventario_id: string; sede_id: string; producto_id: string; empresa_id: string;
          codigo: string; nombre: string; stock_actual: number; stock_minimo: number;
          estado_stock: "agotado" | "stock_bajo";
        };
        Relationships: [];
      };
      v_ventas_por_dia: {
        Row: { sede_id: string; dia: string; cantidad_ventas: number; total_vendido: number; costo_total: number; ganancia_total: number };
        Relationships: [];
      };
      v_ganancia_por_producto: {
        Row: {
          producto_id: string; empresa_id: string; codigo: string; nombre: string;
          cantidad_vendida: number; venta_total: number; costo_total: number;
          ganancia_total: number; margen_pct: number;
        };
        Relationships: [];
      };
      v_ventas_por_medio_pago: {
        Row: { sede_id: string; medio_pago: MedioPago; dia: string; cantidad_ventas: number; total_vendido: number };
        Relationships: [];
      };
      v_ventas_por_trabajador: {
        Row: { usuario_id: string; nombre_usuario: string; sede_id: string; dia: string; cantidad_ventas: number; total_vendido: number };
        Relationships: [];
      };
      v_productos_mas_vendidos: {
        Row: { producto_id: string; nombre: string; empresa_id: string; cantidad_vendida: number; monto_vendido: number };
        Relationships: [];
      };
    };
    Functions: {
      current_profile: {
        Args: Record<string, never>;
        Returns: { profile_id: string; empresa_id: string; sede_id: string | null; rol_codigo: string; activo: boolean }[];
      };
      mi_empresa_id: { Args: Record<string, never>; Returns: string };
      mi_sede_id: { Args: Record<string, never>; Returns: string | null };
      es_administrador: { Args: Record<string, never>; Returns: boolean };
      puede_ver_todas_las_sedes: { Args: Record<string, never>; Returns: boolean };
      has_permiso: { Args: { p_modulo: string; p_accion: string }; Returns: boolean };
      fn_registrar_venta: {
        Args: {
          p_sede_id: string; p_cliente_id: string;
          p_medio_pago: MedioPago; p_lineas: Json; p_observaciones?: string | null; p_pagos?: Json | null;
        };
        Returns: Database["public"]["Tables"]["ventas"]["Row"];
      };
      fn_anular_venta: {
        Args: { p_venta_id: string; p_motivo: string };
        Returns: Database["public"]["Tables"]["ventas"]["Row"];
      };
      fn_registrar_compra: {
        Args: { p_sede_id: string; p_proveedor_id: string; p_numero_documento: string; p_lineas: Json; p_observaciones?: string | null };
        Returns: Database["public"]["Tables"]["compras"]["Row"];
      };
      fn_convertir_cotizacion: {
        Args: { p_cotizacion_id: string; p_medio_pago: MedioPago; p_pagos?: Json | null };
        Returns: Database["public"]["Tables"]["ventas"]["Row"];
      };
      fn_ajustar_stock: {
        Args: {
          p_producto_id: string; p_sede_id: string; p_tipo: "entrada" | "salida"; p_cantidad: number;
          p_motivo: string; p_documento_sustento?: string | null; p_observaciones?: string | null;
        };
        Returns: Database["public"]["Tables"]["movimientos_inventario"]["Row"];
      };
      fn_guardar_inventario_producto: {
        Args: { p_producto_id: string; p_sede_id: string; p_stock_minimo: number; p_costo: number };
        Returns: undefined;
      };
      fn_abrir_caja: {
        Args: { p_caja_id: string; p_monto_apertura: number };
        Returns: Database["public"]["Tables"]["caja_sesiones"]["Row"];
      };
      fn_cerrar_caja: {
        Args: { p_caja_sesion_id: string; p_monto_cierre_real: number };
        Returns: Database["public"]["Tables"]["caja_sesiones"]["Row"];
      };
      fn_dashboard_resumen: {
        Args: { p_sede_id: string; p_fecha?: string };
        Returns: {
          ventas_dia: number; costo_dia: number; ganancia_dia: number; cantidad_ventas: number;
          productos_vendidos: number; stock_critico: number; productos_agotados: number;
        }[];
      };
      fn_actualizar_mi_perfil: {
        Args: { p_nombre?: string | null; p_telefono?: string | null };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      fn_marcar_notificacion_leida: {
        Args: { p_notificacion_id: string };
        Returns: Database["public"]["Tables"]["notificaciones"]["Row"];
      };
      fn_registrar_auditoria: {
        Args: {
          p_accion: string; p_modulo: string; p_tabla_afectada?: string | null;
          p_registro_id?: string | null; p_datos_anteriores?: Json | null; p_datos_nuevos?: Json | null;
        };
        Returns: Database["public"]["Tables"]["audit_logs"]["Row"];
      };
      fn_registrar_movimiento_caja: {
        Args: { p_tipo: "ingreso" | "egreso"; p_medio_pago: MedioPago; p_monto: number; p_concepto: string };
        Returns: Database["public"]["Tables"]["movimientos_caja"]["Row"];
      };
    };
  };
}
