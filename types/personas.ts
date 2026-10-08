export type Cliente = {
  id: string;
  /** Documento de identidad libre (DNI, RUC u otro). Sin validación tributaria. */
  documento: string;
  nombre: string;
  telefono: string;
  correo: string;
  direccion: string;
  activo: boolean;
  registradoEn: string;
  lineaCredito: number;
  riesgo: "bajo" | "medio" | "alto";
};

export type Proveedor = {
  id: string;
  razonSocial: string;
  documento: string;
  telefono: string;
  correo: string;
  direccion: string;
  contacto: string;
  activo: boolean;
  observaciones?: string;
};

export type Trabajador = {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  cargo: string;
  activo: boolean;
  ingresadoEn: string;
  sedeId: string;
  usuarioId?: string;
};

export type RolUsuario = "administrador" | "supervisor";

export type Usuario = {
  id: string;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
  activo: boolean;
  trabajadorId?: string;
};
