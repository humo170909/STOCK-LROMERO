// Implementa UsuariosService contra public.profiles /
// public.roles / public.permisos / public.rol_permisos.
//
// Límite real (no una elección de diseño): crear un usuario con acceso de login
// requiere la Admin API de Supabase Auth (service role), que NUNCA debe llamarse
// desde el navegador — ver lib/supabase/admin.ts. Como el formulario de esta
// pantalla no pide contraseña (y no se agregó ese campo para no cambiar la
// interfaz), crear un usuario nuevo desde aquí lanza un error explicando el
// camino real: Supabase Dashboard → Authentication → Users, y luego el INSERT en
// profiles descrito en supabase/migrations/README.md. Editar un usuario existente
// (nombre, rol) sí funciona de verdad.
import { createClient } from "@/lib/supabase/client";
import { empresaActual, registrarAuditoria } from "./_shared";
import type { UsuariosService } from "../usuarios.types";
import type { AccionPermiso, ModuloSistema, PermisosRol, RolUsuario, Usuario } from "@/types";

const MODULOS: ModuloSistema[] = [
  "ventas", "cotizaciones", "productos", "inventario", "movimientos", "compras", "proveedores",
  "clientes", "caja", "trabajadores", "reportes", "auditoria", "usuarios", "configuracion",
];

const ACCIONES: AccionPermiso[] = ["ver", "crear", "editar", "eliminar", "aprobar", "cancelar", "exportar"];
// Módulos de la sección "Control y sistema": solo el administrador, nunca el supervisor.
const MODULOS_SOLO_ADMIN: ModuloSistema[] = ["auditoria", "usuarios", "configuracion"];

export const usuariosService: UsuariosService = {
  async listarUsuarios(filtros = {}) {
    const supabase = createClient();
    const empresaId = await empresaActual(supabase);

    let query = supabase.from("profiles").select("id, nombre, documento, activo, rol_id").eq("empresa_id", empresaId);
    if (filtros.activo === "activos") query = query.eq("activo", true);
    if (filtros.activo === "inactivos") query = query.eq("activo", false);
    if (filtros.busqueda?.trim()) query = query.ilike("nombre", `%${filtros.busqueda.trim()}%`);

    const { data: perfiles, error } = await query.order("nombre");
    if (error) throw error;
    if (perfiles.length === 0) return [];

    const { data: roles, error: rolesError } = await supabase.from("roles").select("id, codigo");
    if (rolesError) throw rolesError;
    const rolPorId = new Map(roles.map((r) => [r.id, r.codigo as RolUsuario]));

    let usuarios: Usuario[] = perfiles.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      usuario: p.documento ?? "",
      rol: rolPorId.get(p.rol_id) ?? "supervisor",
      activo: p.activo,
    }));

    if (filtros.rol) usuarios = usuarios.filter((u) => u.rol === filtros.rol);
    return usuarios;
  },

  async guardarUsuario(payload) {
    const supabase = createClient();

    if (!payload.id) {
      throw new Error(
        "Crear un usuario con acceso real requiere la Admin API de Supabase (no disponible desde el navegador). " +
          "Créalo en Supabase Dashboard → Authentication → Users y luego registra su fila en public.profiles " +
          "(ver supabase/migrations/README.md, pasos 2-4).",
      );
    }

    const { data: sesion } = await supabase.auth.getUser();
    if (sesion.user?.id === payload.id && payload.rol !== "administrador") {
      throw new Error("No puedes quitarte tu propio rol de administrador.");
    }

    const { data: rol, error: rolError } = await supabase.from("roles").select("id").eq("codigo", payload.rol).single();
    if (rolError) throw rolError;

    const { error } = await supabase.from("profiles").update({ nombre: payload.nombre, rol_id: rol.id }).eq("id", payload.id);
    if (error) throw error;

    await registrarAuditoria(supabase, {
      accion: `Usuario actualizado: ${payload.nombre} (${payload.rol})`,
      modulo: "permisos",
      tablaAfectada: "profiles",
      registroId: payload.id,
    });
  },

  async cambiarEstado(id, activo) {
    const supabase = createClient();
    const { data: sesion } = await supabase.auth.getUser();
    if (!activo && sesion.user?.id === id) {
      throw new Error("No puedes desactivar tu propio usuario.");
    }
    const { error } = await supabase.from("profiles").update({ activo }).eq("id", id);
    if (error) throw error;
    await registrarAuditoria(supabase, {
      accion: `Usuario ${activo ? "activado" : "desactivado"}`,
      modulo: "permisos",
      tablaAfectada: "profiles",
      registroId: id,
    });
  },

  async obtenerPermisos() {
    const supabase = createClient();
    const [{ data: roles, error: rolesError }, { data: permisos, error: permisosError }, { data: rolPermisos, error: rpError }] =
      await Promise.all([
        supabase.from("roles").select("id, codigo"),
        supabase.from("permisos").select("id, modulo, accion"),
        supabase.from("rol_permisos").select("rol_id, permiso_id"),
      ]);
    if (rolesError) throw rolesError;
    if (permisosError) throw permisosError;
    if (rpError) throw rpError;

    const permisoPorId = new Map(permisos.map((p) => [p.id, p]));
    const concedidos = new Set<string>(); // `${rolId}:${modulo}:${accion}`
    for (const rp of rolPermisos) {
      const permiso = permisoPorId.get(rp.permiso_id);
      if (permiso) concedidos.add(`${rp.rol_id}:${permiso.modulo}:${permiso.accion}`);
    }

    const resultado = {} as Record<RolUsuario, PermisosRol>;
    for (const rol of roles) {
      const fila = {} as PermisosRol;
      for (const modulo of MODULOS) {
        fila[modulo] = {} as PermisosRol[ModuloSistema];
        for (const accion of ACCIONES) fila[modulo][accion] = concedidos.has(`${rol.id}:${modulo}:${accion}`);
      }
      resultado[rol.codigo as RolUsuario] = fila;
    }
    return resultado;
  },

  async actualizarPermiso(rol, modulo, accion, valor) {
    if (rol === "administrador") throw new Error("Los permisos del administrador no se pueden modificar.");
    if (MODULOS_SOLO_ADMIN.includes(modulo)) throw new Error("Este módulo es exclusivo del administrador.");

    const supabase = createClient();
    const { data: rolRow, error: rolError } = await supabase.from("roles").select("id").eq("codigo", rol).single();
    if (rolError) throw rolError;

    // Solo la acción marcada: nunca el resto de acciones del módulo.
    const { data: permiso, error: permisoError } = await supabase
      .from("permisos")
      .select("id")
      .eq("modulo", modulo)
      .eq("accion", accion)
      .single();
    if (permisoError) throw permisoError;

    if (valor) {
      const { error } = await supabase
        .from("rol_permisos")
        .upsert({ rol_id: rolRow.id, permiso_id: permiso.id }, { onConflict: "rol_id,permiso_id" });
      if (error) throw error;
    } else {
      const { error } = await supabase.from("rol_permisos").delete().eq("rol_id", rolRow.id).eq("permiso_id", permiso.id);
      if (error) throw error;
    }

    await registrarAuditoria(supabase, {
      accion: `Permiso ${modulo}.${accion} ${valor ? "otorgado" : "revocado"} para el rol ${rol}`,
      modulo: "permisos",
      tablaAfectada: "rol_permisos",
    });
  },
};
