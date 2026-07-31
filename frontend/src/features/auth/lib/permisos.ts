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

  /** Egresos: los ve todo el circuito. El alcance (los míos / los de mi unidad
   * / los de mi almacén) lo aplica el backend, no la UI. Crear es solo del
   * solicitador; las decisiones las habilita cada pantalla según el estado. */
  egresosLeer: [
    "super_admin",
    "admin",
    "solicitador",
    "aprobador",
    "responsable_almacen",
    "observador_almacen",
  ],
  egresosCrear: ["solicitador"],

  /** Imprimir la «Solicitud de materiales»: almacén y administración. NO el
   * solicitante ni el aprobador de unidad — el documento oficial lo emite el
   * almacén (decisión del encargado, 2026-07-29). Es una regla de circuito, no
   * una barrera: el PDF se arma en el navegador con datos que `GET /egresos/:id`
   * ya devuelve, así que no hay endpoint que proteger. */
  egresosImprimir: ["super_admin", "admin", "responsable_almacen"],

  /** Stock: el solicitador entra desde 2026-07-29 — su pedido apunta a un lote,
   * así que necesita ver cuáles hay y con cuánto disponible. El aprobador, desde
   * 2026-07-31: firma sabiendo si queda material (entre que se arma el pedido y
   * su firma pueden pasar días). Los dos ven SOLO su almacén — eso lo aplica
   * `almacenesPermitidos` en el backend, no este mapa. */
  stockLeer: [
    "super_admin",
    "admin",
    "responsable_almacen",
    "observador_almacen",
    "solicitador",
    "aprobador",
  ],
  kardexLeer: [
    "super_admin",
    "admin",
    "responsable_almacen",
    "observador_almacen",
  ],

  usuariosLeer: ["super_admin", "admin"],
  usuariosEscribir: ["super_admin", "admin"],

  /** `GET /usuarios/mi-aprobador`: quién aprueba MIS pedidos. El solicitador
   * entra aunque no lea el padrón — es de su propia unidad y devuelve una sola
   * persona, para nombrarla al confirmar el envío de un egreso. */
  miAprobadorLeer: ["super_admin", "admin", "solicitador"],

  /** Items: la lectura era de CUALQUIER autenticado «porque el solicitador
   * necesita el catálogo para armar sus egresos». Eso valía cuando la línea del
   * egreso apuntaba a un ítem; desde el 2026-07-29 apunta a un LOTE y su
   * selector consulta `GET /stock`. El 2026-07-31 se recortó a quienes de verdad
   * lo consumen: el buscador del KARDEX y el selector de ítem del formulario de
   * INGRESO. Solo la escritura es admin. */
  itemsLeer: [
    "super_admin",
    "admin",
    "responsable_almacen",
    "observador_almacen",
  ],
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
