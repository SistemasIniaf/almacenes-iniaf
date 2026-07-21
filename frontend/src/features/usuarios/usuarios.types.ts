import type { Rol } from "@/features/auth/lib/auth.types"
import type { PaginationQuery } from "@/lib/types"

/** Forma que devuelve el backend (`usuarioSelect`): nunca incluye el password. */
export interface Usuario {
  id: number
  nombre: string
  cargo: string | null
  usuario: string
  rol: Rol
  activo: boolean
  unidadId: number | null
  almacenId: number | null
  unidad: { id: number; nombre: string; sigla: string } | null
  almacen: { id: number; nombre: string } | null
  /** Solo para observador_almacen; el backend lo anida bajo `almacen`. */
  almacenesObservados: { almacen: { id: number; nombre: string } }[]
  createdAt: string
  updatedAt: string
}

export interface QueryUsuarios extends PaginationQuery {
  rol?: Rol
  activo?: boolean
  unidadId?: number
  almacenId?: number
}

export interface CreateUsuarioPayload {
  nombre: string
  cargo?: string | null
  usuario: string
  password: string
  rol: Rol
  activo?: boolean
  unidadId?: number | null
  almacenId?: number | null
  almacenesObservados?: number[]
}

/** En update todo es opcional; `password` solo viaja si se quiere cambiar. */
export type UpdateUsuarioPayload = Partial<CreateUsuarioPayload>

// ---------------------------------------------------------------------------
// Reglas de campos por rol — espejo de ROLES_CON_UNIDAD / ROLES_CON_ALMACEN
// del backend (usuarios.service.ts). Si cambian alla, cambiar aca.
// ---------------------------------------------------------------------------

// Los tres roles del circuito de egresos (solicitador → aprobador →
// responsable_almacen) llevan unidad Y almacén. La unicidad es otra cosa: el
// aprobador es único por unidad y el responsable, único por almacén.
export const ROLES_CON_UNIDAD: Rol[] = [
  "solicitador",
  "aprobador",
  "responsable_almacen",
]

export const ROLES_CON_ALMACEN: Rol[] = [
  "solicitador",
  "aprobador",
  "responsable_almacen",
]

/** Roles sin cargo obligatorio — espejo de ROLES_SIN_CARGO del service. */
export const ROLES_SIN_CARGO: Rol[] = ["super_admin", "admin"]

export function requiereCargo(rol: Rol): boolean {
  return !ROLES_SIN_CARGO.includes(rol)
}

export function requiereUnidad(rol: Rol): boolean {
  return ROLES_CON_UNIDAD.includes(rol)
}

export function requiereAlmacen(rol: Rol): boolean {
  return ROLES_CON_ALMACEN.includes(rol)
}

/** Solo observador_almacen lleva la lista de almacenes observados (m2m). */
export function permiteObservados(rol: Rol): boolean {
  return rol === "observador_almacen"
}

/** Roles que solo puede haber uno ACTIVO por unidad o por almacén. */
export function esRolUnico(rol: Rol): boolean {
  return rol === "aprobador" || rol === "responsable_almacen"
}
