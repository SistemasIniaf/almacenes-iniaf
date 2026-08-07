/**
 * Formato de números del sistema, en un solo lugar.
 *
 * Los tres casos NO se muestran igual, aunque los tres sean números:
 *
 * - **`moneda`** — importes: SIEMPRE 2 decimales. Un total contable se lee en
 *   columna y tiene que alinearse; `1.200` y `1.200,00` no son lo mismo en un
 *   estado financiero.
 * - **`cantidad`** — unidades: sin decimales cuando es entera. Se cuentan
 *   paquetes y piezas, así que «195,00 PAQUETE» sobra: es `195`. Los 2
 *   decimales aparecen solo cuando de verdad hay fracción (`1,5 LITRO`).
 * - **`precio`** — precio unitario: hasta 5 decimales, PERO sin ceros de
 *   relleno. La columna es `Decimal(12,5)` porque un unitario puede ser fino
 *   (`0,00125` el gramo), no porque todo precio tenga cinco decimales: mostrar
 *   `25,00000` es ruido que además desalinea la columna.
 */

const LOCALE = "es-BO"

/** Importe: 2 decimales fijos. */
export const moneda = (valor: string | number): string =>
  Number(valor).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/** Cantidad: entera sin decimales, fraccionaria con 2. */
export const cantidad = (valor: string | number): string => {
  const n = Number(valor)
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Precio unitario: 2 decimales como piso y hasta 5 si los tiene.
 * `25` → `25,00` · `25,5` → `25,50` · `0,00125` → `0,00125`.
 */
export const precio = (valor: string | number): string =>
  Number(valor).toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  })

/**
 * Separador entre el correlativo y la gestión: **guion**, no barra
 * (2026-08-07, pedido de la institución).
 *
 * La barra hacía que `003/2026` se leyera como una fecha —marzo de 2026— sobre
 * todo en los reportes, donde el número cae al lado de la fecha del documento.
 * El guion rompe esa lectura de entrada.
 */
export const SEPARADOR_DOCUMENTO = "-"

/**
 * Número impreso de un documento (ingreso o egreso): `003-2026`.
 *
 * Vive acá y no en cada módulo porque el formato se armaba **a mano en nueve
 * lugares** —pantallas, toasts, los cuatro PDF y el Excel—, así que cambiar el
 * separador significaba encontrarlos todos. `etiquetaNumero()` de ingresos y de
 * egresos ahora delegan en esto.
 *
 * Sin número devuelve «—»: un borrador de egreso todavía no lo tiene, se estampa
 * al enviar.
 */
export const numeroDocumento = (documento: {
  numero: number | null
  gestion: number | null
}): string =>
  documento.numero == null || documento.gestion == null
    ? "—"
    : `${String(documento.numero).padStart(3, "0")}${SEPARADOR_DOCUMENTO}${documento.gestion}`
