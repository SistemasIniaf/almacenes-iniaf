/**
 * Colores del punto de `BadgeEstado`. Son un SEMÁFORO: cada tono significa lo
 * mismo en todo el sistema, sin importar el módulo. Antes de agregar uno nuevo,
 * fijate si el estado no entra en alguno de estos cinco.
 *
 * Van en un archivo aparte y no dentro de `BadgeEstado` porque exportar
 * constantes desde un archivo de componentes rompe el fast refresh de Vite
 * (la regla `react-refresh/only-export-components` del repo).
 */
export const PUNTO = {
  /** Terminado bien: entregado, confirmado, activo. */
  ok: "bg-emerald-500",
  /** Esperando a alguien. */
  espera: "bg-amber-500",
  /** En curso, ya avanzó un paso. */
  proceso: "bg-sky-500",
  /** Anulado, rechazado. */
  alto: "bg-red-500",
  /** Todavía no arrancó, o dado de baja: sin urgencia ni problema. */
  neutro: "bg-muted-foreground/50",
} as const

export type TonoPunto = keyof typeof PUNTO
