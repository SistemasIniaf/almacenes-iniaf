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
 * El mismo criterio que `precio`, pero para el VALOR de un campo `<input
 * type="number">` (punto decimal, sin miles): piso de `minimos` decimales y
 * sin ceros de relleno más allá. `"100"` → `"100.00"` · `"25.50000"` →
 * `"25.50"` · `"0.00125"` queda igual. Vacío o inválido se devuelve tal cual,
 * para que lo marque el schema.
 */
export const conDecimalesMinimos = (valor: string, minimos: number): string => {
  const texto = valor.trim()
  const numero = Number(texto)
  if (texto === "" || !Number.isFinite(numero)) return valor
  const decimales = (texto.split(".")[1] ?? "").replace(/0+$/, "").length
  return numero.toFixed(Math.max(minimos, decimales))
}

/**
 * Campos numéricos con COMA decimal (2026-11-17): en pantalla va la coma, como
 * en subtotales y reportes; el valor del formulario sigue con PUNTO, así los
 * schemas y los payloads no cambian. Los usan `NumberField` y el «A entregar»
 * del egreso.
 */
export const numeroAPantalla = (valor: unknown) =>
  String(valor ?? "").replace(".", ",")

/**
 * El mismo relleno, pero para lo que el usuario ACABA DE ESCRIBIR (el blur de
 * un campo): solo AGREGA ceros hasta `minimos`, nunca quita dígitos.
 * `conDecimalesMinimos` recorta los ceros de más, que está bien para un valor
 * que viene del backend (`25.50000`), pero en lo tecleado escondía un error:
 * `2.000` en una cantidad —¿dos, o dos mil?— quedaba en `2,00` sin avisar.
 * Así se queda como `2,000` y lo frena «Máximo 2 decimales» (2026-11-18).
 */
export const completarDecimales = (valor: string, minimos: number): string => {
  const texto = valor.trim()
  if (texto === "" || !Number.isFinite(Number(texto))) return valor
  const [entero, decimales = ""] = texto.split(".")
  return decimales.length >= minimos
    ? texto
    : `${entero}.${decimales.padEnd(minimos, "0")}`
}

/**
 * Grupos de miles (ya partidos): `1` + `234` + `567`. El primero puede tener
 * más de tres dígitos: al teclear, los miles anteriores ya se juntaron.
 */
const sonMiles = (grupos: string[]) =>
  grupos.length > 1 &&
  /^\d+$/.test(grupos[0]) &&
  grupos.slice(1).every((g) => /^\d{3}$/.test(g))

/**
 * Deja solo dígitos y UN separador decimal, y lo devuelve con punto.
 *
 * Se aplica en cada tecla sobre lo que se VE en el campo (donde el decimal ya
 * se muestra como coma), así que tiene que dar bien tanto para un pegado entero
 * como para cada paso intermedio del tecleo:
 *
 * - Un solo separador (coma o punto) es el decimal: `12,5` y `12.5` valen lo
 *   mismo. El punto es lo que da el teclado numérico.
 * - Con varios, el ÚLTIMO es el decimal y los anteriores son de miles —siempre
 *   que de verdad formen grupos de tres—: `1.234,56` (como lo copia Excel en
 *   es-BO), `1,234.56` y también `10.000,00` TECLEADO, que llega acá como
 *   `10,000,` porque el primer punto ya se mostró como coma. Hasta el
 *   2026-11-18 esa segunda coma se descartaba y diez mil quedaban en diez.
 * - Varios puntos sin coma son todos de miles: `1.234.567`. Tecleado llega
 *   como `1,234.` —una coma que era punto y un punto recién escrito al final—:
 *   quien pone un segundo punto está separando miles, así que ahí TODOS lo
 *   son, y el decimal, si viene, será la coma de después.
 * - Si lo anterior al último separador NO son grupos de miles (`1,5,`), el
 *   separador de más se descarta: es una tecla repetida, no un número nuevo.
 */
export const numeroAInterno = (texto: string) => {
  const limpio = texto.replace(/[^\d.,]/g, "")
  const separadores = limpio.match(/[.,]/g) ?? []
  if (separadores.length === 0) return limpio

  const partes = limpio.split(/[.,]/)
  if (separadores.length === 1) return `${partes[0]}.${partes[1]}`

  // Solo puntos: miles.
  if (!limpio.includes(",") && sonMiles(partes)) return partes.join("")

  const enteros = partes.slice(0, -1)
  // Miles en curso: termina en un punto recién tecleado.
  if (
    limpio.endsWith(".") &&
    !limpio.slice(0, -1).includes(".") &&
    sonMiles(enteros)
  )
    return enteros.join("")
  if (sonMiles(enteros)) return `${enteros.join("")}.${partes.at(-1)}`

  // No son miles: el primer separador es el decimal y el resto sobra.
  return `${partes[0]}.${partes.slice(1).join("")}`
}

/** Decimales escritos en un valor interno (con punto). */
export const decimalesEscritos = (valor: string) =>
  (valor.split(".")[1] ?? "").length

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

/**
 * De qué documento viene un LOTE: `ingreso 001-2026`, o `traspaso 002-2026` si
 * llegó por un traspaso entre almacenes (2026-10-29). El ingreso que lo porta
 * en ese caso no tiene número propio — el documento es el traspaso. Los lotes
 * de la carga inicial (2026-11-12) tampoco tienen número: son «saldo inicial».
 */
export const documentoDeLote = (ingreso: {
  numero: number | null
  gestion: number | null
  traspaso?: { numero: number; gestion: number } | null
  saldoInicial?: boolean
}): string =>
  ingreso.traspaso
    ? `traspaso ${numeroDocumento(ingreso.traspaso)}`
    : ingreso.saldoInicial
      ? "saldo inicial"
      : `ingreso ${numeroDocumento(ingreso)}`
