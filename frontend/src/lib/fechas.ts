/**
 * Conversión de fechas para los filtros que viajan a la API.
 *
 * Vive suelto y no dentro del componente que lo usa porque un archivo que
 * exporta un componente no puede exportar además funciones sueltas sin romper
 * el fast-refresh de Vite.
 */

/**
 * `YYYY-MM-DD` en hora LOCAL.
 *
 * `toISOString()` NO sirve acá: pasa a UTC y en un huso negativo (Bolivia es
 * UTC-4) devuelve el día anterior para todo lo elegido antes de las 20:00 —
 * un rango del 1 al 31 se mandaría como 31/12 al 30/01.
 */
export function aIsoLocal(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/**
 * El DÍA (`YYYY-MM-DD`, hora local) de un valor que puede ser un día suelto o
 * un instante ISO completo. Para los reportes: cortar el ISO con
 * `slice(0, 10)` da el día en UTC, y todo lo registrado entre las 20:00 y la
 * medianoche de Bolivia salía impreso con el día siguiente (2026-11-18).
 */
export function diaLocal(iso: string): string {
  return iso.length <= 10 ? iso : aIsoLocal(new Date(iso))
}
