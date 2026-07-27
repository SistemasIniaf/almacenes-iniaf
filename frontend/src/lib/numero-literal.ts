/**
 * Monto en letras para los documentos impresos ("SON: MIL QUINIENTOS 50/100
 * BOLIVIANOS"). Va en `lib/` y no en la feature porque el egreso va a necesitar
 * lo mismo.
 *
 * Cubre hasta 999.999.999, de sobra para un ingreso de almacén.
 */

const UNIDADES = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIUNO",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
]

const DECENAS = [
  "",
  "",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
]

const CENTENAS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
]

/** 0–999. */
function hastaNovecientos(n: number): string {
  if (n === 0) return ""
  if (n === 100) return "CIEN"
  if (n < 30) return UNIDADES[n]
  if (n < 100) {
    const decena = Math.floor(n / 10)
    const unidad = n % 10
    return unidad === 0
      ? DECENAS[decena]
      : `${DECENAS[decena]} Y ${UNIDADES[unidad]}`
  }
  const centena = Math.floor(n / 100)
  const resto = n % 100
  return resto === 0
    ? CENTENAS[centena]
    : `${CENTENAS[centena]} ${hastaNovecientos(resto)}`
}

/** "UNO" y "VEINTIUNO" se apocopan delante de MIL y MILLÓN: "VEINTIÚN MIL". */
function apocopar(texto: string): string {
  if (texto === "UNO") return "UN"
  if (texto.endsWith("VEINTIUNO")) return texto.replace(/VEINTIUNO$/, "VEINTIÚN")
  if (texto.endsWith("UNO")) return texto.replace(/UNO$/, "UN")
  return texto
}

/** Parte entera en letras. */
export function enteroALiteral(n: number): string {
  if (n === 0) return "CERO"

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const partes: string[] = []

  if (millones === 1) partes.push("UN MILLÓN")
  else if (millones > 1)
    partes.push(`${apocopar(hastaNovecientos(millones))} MILLONES`)

  if (miles === 1) partes.push("MIL")
  else if (miles > 1) partes.push(`${apocopar(hastaNovecientos(miles))} MIL`)

  if (resto > 0) partes.push(hastaNovecientos(resto))

  return partes.join(" ")
}

/**
 * Monto en la forma que usan los documentos oficiales:
 * `SON: MIL QUINIENTOS TREINTA 50/100 BOLIVIANOS`.
 */
export function montoALiteral(monto: number): string {
  const entero = Math.floor(Math.abs(monto))
  // Redondea a 2 decimales antes de partirlos, si no 0.1+0.2 da 29/100.
  const centavos = Math.round((Math.abs(monto) - entero) * 100)
  // El redondeo puede desbordar a 100 (ej. 9,999 → 10 y 00/100).
  const [enteroFinal, centavosFinal] =
    centavos === 100 ? [entero + 1, 0] : [entero, centavos]

  const signo = monto < 0 ? "MENOS " : ""
  return `SON: ${signo}${enteroALiteral(enteroFinal)} ${String(centavosFinal).padStart(2, "0")}/100 BOLIVIANOS`
}
