import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  FileText,
  Gauge,
  KeySquare,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Las pantallas no construidas aún muestran un placeholder en vez de 404. */
  listo: boolean;
  /** Módulo de permisos que se necesita para ver la opción. Sin módulo = visible para todos. */
  modulo?: string;
  /** Acción del módulo (por defecto "ver"). */
  accion?: string;
  /** Solo administrador: ni se dibuja para otros roles ni mientras la sesión carga. */
  soloAdmin?: boolean;
};

export type NavGroup = {
  titulo: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    titulo: "Principal",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, listo: true }],
  },
  {
    titulo: "Ventas",
    items: [
      { label: "Nueva venta", href: "/ventas/nueva", icon: ShoppingCart, modulo: "ventas", accion: "crear", listo: true },
      { label: "Ventas", href: "/ventas", icon: Receipt, modulo: "ventas", listo: true },
      { label: "Cotizaciones", href: "/cotizaciones", icon: FileText, modulo: "cotizaciones", listo: true },
    ],
  },
  {
    titulo: "Inventario",
    items: [
      { label: "Productos y stock", href: "/productos", icon: Package, modulo: "productos", listo: true },
      { label: "Movimientos", href: "/movimientos", icon: ArrowLeftRight, modulo: "movimientos", listo: true },
    ],
  },
  {
    titulo: "Compras",
    items: [
      { label: "Compras", href: "/compras", icon: Truck, modulo: "compras", listo: true },
      { label: "Proveedores", href: "/proveedores", icon: Building2, modulo: "proveedores", listo: true },
    ],
  },
  {
    titulo: "Gestión y finanzas",
    items: [
      { label: "Clientes", href: "/clientes", icon: Users, modulo: "clientes", listo: true },
      { label: "Ingresos y Caja", href: "/caja", icon: Landmark, modulo: "caja", listo: true },
      { label: "Trabajadores", href: "/trabajadores", icon: UserRound, modulo: "trabajadores", listo: true },
      { label: "Reportes", href: "/reportes", icon: BarChart3, modulo: "reportes", listo: true },
    ],
  },
  {
    titulo: "Control y sistema",
    items: [
      { label: "Auditoría", href: "/auditoria", icon: ShieldCheck, soloAdmin: true, listo: true },
      { label: "Usuarios y Permisos", href: "/usuarios", icon: KeySquare, soloAdmin: true, listo: true },
      { label: "Configuración", href: "/configuracion", icon: Settings, soloAdmin: true, listo: true },
    ],
  },
];

export const navItemsPlanos: NavItem[] = navGroups.flatMap((g) => g.items);

export const iconoModuloGenerico: LucideIcon = Gauge;
