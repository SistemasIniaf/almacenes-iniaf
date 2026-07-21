/** Espejo del enum `Rol` del backend (generated/prisma/enums). */
export const ROLES = [
  "super_admin",
  "admin",
  "solicitador",
  "aprobador",
  "responsable_almacen",
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
  observador_almacen: "Observador de almacen",
}

/**
 * Color del badge de rol en los listados. La idea es que los roles escasos y
 * con poder (admins, central, responsable) salten a la vista, y que
 * `solicitador` —el rol mas numeroso por lejos— quede neutro para no convertir
 * la tabla en un semaforo. Se usan colores explicitos (no las variantes del
 * Badge) porque hacen falta 6 tonos distinguibles en claro y en oscuro.
 */
export const ROL_BADGE_CLASS: Record<Rol, string> = {
  super_admin:
    "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  admin:
    "border-indigo-300 bg-indigo-100 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  solicitador: "border-border bg-muted text-muted-foreground",
  aprobador:
    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  responsable_almacen:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  observador_almacen:
    "border-dashed border-border bg-transparent text-muted-foreground",
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
