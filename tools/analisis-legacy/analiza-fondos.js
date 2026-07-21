// ¿Cuanto importa el fondo? Mide si un mismo item se compra con varios fondos.
const fs = require("fs")
const readline = require("readline")

function parseValores(linea) {
  const inicio = linea.indexOf("VALUES (")
  if (inicio < 0) return null
  const cuerpo = linea.slice(inicio + 8, linea.lastIndexOf(")"))
  const campos = []
  let actual = "", enComilla = false
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i]
    if (enComilla) {
      if (c === "\\") { actual += cuerpo[++i]; continue }
      if (c === "'") { enComilla = false; continue }
      actual += c
    } else if (c === "'") enComilla = true
    else if (c === ",") { campos.push(actual.trim()); actual = "" }
    else actual += c
  }
  campos.push(actual.trim())
  return campos
}

const T = { ingresosalmacenes: [], ingresositems: [], itemsalmacenes: [], codificadores: [] }
const rl = readline.createInterface({
  input: fs.createReadStream(process.argv[2], { encoding: "latin1" }),
  crlfDelay: Infinity,
})
rl.on("line", (l) => {
  const m = l.match(/^INSERT INTO `([a-z]+)` VALUES /)
  if (!m || !(m[1] in T)) return
  const v = parseValores(l)
  if (v) T[m[1]].push(v)
})
rl.on("close", () => {
  const n = (v) => (v === "NULL" || v === "" ? null : Number(v))
  // ingreso -> {fondo, unidad, anio}
  const ing = new Map(T.ingresosalmacenes.map((v) => [n(v[0]), { fondo: n(v[3]), unidad: n(v[1]), anio: (v[5] || "").slice(0, 4) }]))
  const nombreItem = new Map(T.itemsalmacenes.map((v) => [n(v[0]), v[3]]))
  const codif = new Map(T.codificadores.map((v) => [n(v[0]), v[1]]))

  // item -> set de fondos (solo gestiones recientes)
  const fondosPorItem = new Map()
  T.ingresositems.forEach((v) => {
    const cab = ing.get(n(v[1]))
    if (!cab || Number(cab.anio) < 2024) return
    const item = n(v[2])
    if (!fondosPorItem.has(item)) fondosPorItem.set(item, new Set())
    fondosPorItem.get(item).add(cab.fondo)
  })

  let uno = 0, varios = 0
  const ranking = []
  fondosPorItem.forEach((fondos, item) => {
    if (fondos.size > 1) { varios++; ranking.push([item, fondos.size]) } else uno++
  })
  console.log(`Items con movimiento 2024-2026: ${fondosPorItem.size}`)
  console.log(`  comprados con UN solo fondo:      ${uno} (${((uno / fondosPorItem.size) * 100).toFixed(1)}%)`)
  console.log(`  comprados con VARIOS fondos:      ${varios} (${((varios / fondosPorItem.size) * 100).toFixed(1)}%)`)
  console.log("\nEjemplos de items comprados con mas fondos distintos:")
  ranking.sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([item, k]) =>
    console.log(`  ${String(k).padStart(2)} fondos  ${(nombreItem.get(item) || "?").slice(0, 55)}`))

  // ¿el mismo item se compro a precios distintos? (importa para valuar)
  const preciosPorItem = new Map()
  T.ingresositems.forEach((v) => {
    const cab = ing.get(n(v[1]))
    if (!cab || Number(cab.anio) < 2024) return
    const item = n(v[2]), precio = n(v[4])
    if (precio == null) return
    if (!preciosPorItem.has(item)) preciosPorItem.set(item, new Set())
    preciosPorItem.get(item).add(precio)
  })
  let mismoPrecio = 0, distintos = 0
  const spread = []
  preciosPorItem.forEach((precios, item) => {
    if (precios.size > 1) {
      distintos++
      const a = [...precios]
      spread.push([item, Math.min(...a), Math.max(...a)])
    } else mismoPrecio++
  })
  console.log(`\nItems con compras 2024-2026: ${preciosPorItem.size}`)
  console.log(`  siempre al mismo precio:  ${mismoPrecio} (${((mismoPrecio / preciosPorItem.size) * 100).toFixed(1)}%)`)
  console.log(`  a precios DISTINTOS:      ${distintos} (${((distintos / preciosPorItem.size) * 100).toFixed(1)}%)`)
  console.log("\nEjemplos de variacion de precio del mismo item:")
  spread.sort((a, b) => b[2] / b[1] - a[2] / a[1]).slice(0, 6).forEach(([item, min, max]) =>
    console.log(`  ${(nombreItem.get(item) || "?").slice(0, 45).padEnd(46)} Bs ${min} .. ${max}`))
})
