import { ROLES } from "@/features/auth/lib/auth.types"

import type { AuthUser, Rol } from "@/features/auth/lib/auth.types"

/**
 * Espejo de los `@Roles(...)` de cada controlador del backend. La UI solo OCULTA
 * lo que el usuario no puede hacer; quien realmente autoriza es el backend.
 * Si cambia un `@Roles` alla, hay que reflejarlo aca.
 */
export const PERMISOS = {
  /** Unidades: escritura solo super_admin; admin unicamente lee (ver CLAUDE.md). */
  unidadesLeer: ["super_admin", "admin"],
  unidadesEscribir: ["super_admin"],

  almacenesLeer: ["super_admin", "admin"],
  almacenesEscribir: ["super_admin", "admin"],

  proveedoresLeer: ["super_admin", "admin", "responsable_almacen"],
  proveedoresEscribir: ["super_admin", "admin"],

  /** Fuentes de financiamiento: escritura super_admin/admin; el
   * responsable_almacen solo lee (elige la fuente en la cabecera del ingreso). */
  fuentesLeer: ["super_admin", "admin", "responsable_almacen"],
  fuentesEscribir: ["super_admin", "admin"],

  /** Ingresos: escritura super_admin/admin/responsable_almacen; lectura además
   * observador_almacen (auditoría). El scope por almacén lo aplica el backend. */
  ingresosLeer: [
    "super_admin",
    "admin",
    "responsable_almacen",
    "observador_almacen",
  ],
  ingresosEscribir: ["super_admin", "admin", "responsable_almacen"],

  usuariosLeer: ["super_admin", "admin"],
  usuariosEscribir: ["super_admin", "admin"],

  /** Items: la lectura queda abierta a cualquier autenticado — el solicitador
   * necesita el catalogo para armar sus egresos. Solo la escritura es admin. */
  itemsLeer: ROLES,
  itemsEscribir: ["super_admin", "admin"],

  /** Partidas: lectura super_admin/admin; solo super_admin activa/desactiva. */
  partidasLeer: ["super_admin", "admin"],
  partidasEscribir: ["super_admin"],
} satisfies Record<string, readonly Rol[]>

export type Permiso = keyof typeof PERMISOS

export function tienePermiso(
  user: AuthUser | null,
  permiso: Permiso
): boolean {
  if (!user) return false
  return (PERMISOS[permiso] as readonly Rol[]).includes(user.rol)
}
