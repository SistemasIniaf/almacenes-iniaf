/** Espejo del enum `Rol` del backend (generated/prisma/enums). */
export const ROLES = [
  "super_admin",
  "admin",
  "solicitador",
  "aprobador",
  "responsable_almacen",
  "central",
  "observador_almacen",
] as const

export type Rol = (typeof ROLES)[number]

/** Etiquetas para mostrar el rol en la UI. */
export const ROL_LABEL: Record<Rol, string> = {
  super_admin: "Super administrador",
  admin: "Administrador",
  solicitador: "Solicitador",
  aprobador: "Aprobador",
  responsable_almacen: "Responsable de almacen",
  central: "Central",
  observador_almacen: "Observador de almacen",
}

/** Usuario autenticado tal como lo devuelve `GET /auth/me`. */
export interface AuthUser {
  id: number
  usuario: string
  rol: Rol
  unidadId: number | null
  almacenId: number | null
  /** Solo viene en la respuesta del login, no en `/auth/me`. */
  nombre?: string
}

export interface LoginRequest {
  usuario: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser & { nombre: string }
}
