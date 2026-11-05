/**
 * Cierre de sesión por inactividad (2026-11-05, pedido del usuario): a los 30
 * minutos sin tocar el sistema, la sesión se cierra sola.
 *
 * La última actividad vive en localStorage y NO en el estado de React por dos
 * razones: la comparten todas las pestañas (trabajar en una mantiene viva la
 * otra, que usa los mismos tokens) y sobrevive a cerrar el navegador — volver
 * al otro día con la pestaña restaurada no tiene que encontrar la sesión
 * abierta.
 *
 * Es una regla del FRONTEND: el refresh token sigue valiendo 7 días. Alcanza
 * para lo que se busca —que una PC abandonada no quede con la sesión abierta—,
 * pero no es una barrera contra quien ya tenga los tokens.
 */

const CLAVE = "almacenes.ultimaActividad"

export const MINUTOS_INACTIVIDAD = 30
export const LIMITE_INACTIVIDAD_MS = MINUTOS_INACTIVIDAD * 60 * 1000
/** Cuánto antes del cierre aparece el aviso para seguir conectado. */
export const AVISO_INACTIVIDAD_MS = 60 * 1000

export function marcarActividad(): void {
  localStorage.setItem(CLAVE, String(Date.now()))
}

export function olvidarActividad(): void {
  localStorage.removeItem(CLAVE)
}

/**
 * Milisegundos que le quedan a la sesión. Sin registro (una sesión abierta
 * antes de que existiera esta regla) cuenta como recién activa.
 */
export function restanteInactividad(): number {
  const ultima = Number(localStorage.getItem(CLAVE))
  if (!ultima) {
    marcarActividad()
    return LIMITE_INACTIVIDAD_MS
  }
  return ultima + LIMITE_INACTIVIDAD_MS - Date.now()
}
