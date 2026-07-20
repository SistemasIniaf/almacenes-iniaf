import type { Rol } from "@/features/auth/lib/auth.types"
import type { PaginationQuery } from "@/lib/types"

/** Forma que devuelve el backend (`usuarioSelect`): nunca incluye el password. */
export interface Usuario {
  id: number
  nombre: string
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

export const ROLES_CON_UNIDAD: Rol[] = ["solicitador", "aprobador"]

// aprobador lleva unidad Y almacén, igual que solicitador (sigue siendo único
// por unidad; su almacén no es único).
export const ROLES_CON_ALMACEN: Rol[] = [
  "solicitador",
  "aprobador",
  "responsable_almacen",
  "central",
]

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
  return rol === "aprobador" || rol === "responsable_almacen" || rol === "central"
}
