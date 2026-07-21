// Analiza el dump del sistema viejo de almacenes (MySQL, una fila por INSERT).
// Solo lectura: responde las preguntas de negocio que el codigo no contesta.
const fs = require("fs")
const readline = require("readline")

const RUTA = process.argv[2]

// Parsea la tupla de un `INSERT INTO x VALUES (...)` respetando comillas.
function parseValores(linea) {
  const inicio = linea.indexOf("VALUES (")
  if (inicio < 0) return null
  const cuerpo = linea.slice(inicio + 8, linea.lastIndexOf(")"))
  const campos = []
  let actual = ""
  let enComilla = false
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i]
    if (enComilla) {
      if (c === "\\") { actual += cuerpo[++i]; continue }
      if (c === "'") { enComilla = false; continue }
      actual += c
    } else if (c === "'") {
      enComilla = true
    } else if (c === ",") {
      campos.push(actual.trim())
      actual = ""
    } else {
      actual += c
    }
  }
  campos.push(actual.trim())
  return campos
}

const TABLAS = {
  ingresosalmacenes: [],
  ingresositems: [],
  egresosalmacenes: [],
  egresositems: [],
  itemsalmacenes: [],
  codificadores: [],
  unidades: [],
}

const rl = readline.createInterface({
  input: fs.createReadStream(RUTA, { encoding: "latin1" }),
  crlfDelay: Infinity,
})

rl.on("line", (linea) => {
  const m = linea.match(/^INSERT INTO `([a-z]+)` VALUES /)
  if (!m || !(m[1] in TABLAS)) return
  const valores = parseValores(linea)
  if (valores) TABLAS[m[1]].push(valores)
})

rl.on("close", () => {
  const num = (v) => (v === "NULL" || v === "" ? null : Number(v))
  const anio = (f) => (f && f !== "NULL" ? f.slice(0, 4) : "?")

  const ingresos = TABLAS.ingresosalmacenes.map((v) => ({
    id: num(v[0]), unidad: num(v[1]), proveedor: num(v[2]), fondo: num(v[3]),
    nro: num(v[4]), fecha: v[5], obs: v[6], factura: v[8],
    tipoDoc: num(v[14]),
  }))
  const ingItems = TABLAS.ingresositems.map((v) => ({
    id: num(v[0]), ingreso: num(v[1]), item: num(v[2]),
    cantidad: num(v[3]), precio: num(v[4]), saldo: num(v[6]),
  }))
  const egrItems = TABLAS.egresositems.map((v) => ({
    id: num(v[0]), egreso: num(v[1]), ingItem: num(v[2]), cantidad: num(v[3]),
  }))
  const codif = new Map(TABLAS.codificadores.map((v) => [num(v[0]), v[1]]))

  const linea = (t) => console.log("\n" + "=".repeat(70) + "\n" + t + "\n" + "=".repeat(70))

  linea("VOLUMEN")
  for (const [t, filas] of Object.entries(TABLAS)) {
    console.log(`  ${t.padEnd(20)} ${String(filas.length).padStart(8)} filas`)
  }

  linea("1) INGRESOS POR GESTION")
  const porAnio = {}
  ingresos.forEach((i) => {
    const a = anio(i.fecha)
    porAnio[a] = porAnio[a] || { n: 0, nroMin: Infinity, nroMax: -Infinity, unidades: new Set() }
    porAnio[a].n++
    if (i.nro != null) {
      porAnio[a].nroMin = Math.min(porAnio[a].nroMin, i.nro)
      porAnio[a].nroMax = Math.max(porAnio[a].nroMax, i.nro)
    }
    porAnio[a].unidades.add(i.unidad)
  })
  console.log("  gestion  ingresos  nro min  nro max  unidades")
  Object.keys(porAnio).sort().forEach((a) => {
    const d = porAnio[a]
    console.log(`  ${a.padEnd(9)}${String(d.n).padStart(8)}${String(d.nroMin).padStart(9)}${String(d.nroMax).padStart(9)}${String(d.unidades.size).padStart(10)}`)
  })

  linea("2) ¿EL CORRELATIVO REINICIA? (por unidad+gestion, ultimas gestiones)")
  const porUG = {}
  ingresos.forEach((i) => {
    const k = `${i.unidad}|${anio(i.fecha)}`
    porUG[k] = porUG[k] || { max: -Infinity, min: Infinity, n: 0 }
    if (i.nro != null) {
      porUG[k].max = Math.max(porUG[k].max, i.nro)
      porUG[k].min = Math.min(porUG[k].min, i.nro)
    }
    porUG[k].n++
  })
  Object.entries(porUG)
    .filter(([k]) => Number(k.split("|")[1]) >= 2022)
    .sort()
    .slice(0, 25)
    .forEach(([k, d]) => console.log(`  unidad ${k.split("|")[0].padEnd(5)} gestion ${k.split("|")[1]}  nros ${d.min}..${d.max}  (${d.n} ingresos)`))

  linea("3) INGRESOS SIN PROVEEDOR / SIN FACTURA")
  const sinProv = ingresos.filter((i) => !i.proveedor).length
  const sinFactura = ingresos.filter((i) => !i.factura || ["", "-", "0"].includes(i.factura.trim())).length
  console.log(`  sin proveedor: ${sinProv} de ${ingresos.length}`)
  console.log(`  sin nro de factura util: ${sinFactura} de ${ingresos.length}`)

  linea("4) TIPO DE DOCUMENTO (IDTIPODOCUMENTO)")
  const porTipo = {}
  ingresos.forEach((i) => { porTipo[i.tipoDoc] = (porTipo[i.tipoDoc] || 0) + 1 })
  Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([t, n]) =>
    console.log(`  ${String(t).padEnd(8)} ${String(n).padStart(7)}   ${codif.get(Number(t)) ?? "(no esta en codificadores)"}`))

  linea("5) FONDOS (IDFONDO)")
  const porFondo = {}
  ingresos.forEach((i) => { porFondo[i.fondo] = (porFondo[i.fondo] || 0) + 1 })
  Object.entries(porFondo).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([f, n]) =>
    console.log(`  ${String(f).padEnd(8)} ${String(n).padStart(7)}   ${codif.get(Number(f)) ?? "?"}`))

  linea("6) ¿UN EGRESO SACA DEL MISMO ITEM DESDE VARIOS LOTES?")
  const itemDeLote = new Map(ingItems.map((ii) => [ii.id, ii.item]))
  const porEgresoItem = new Map()
  egrItems.forEach((ei) => {
    const item = itemDeLote.get(ei.ingItem)
    if (item == null) return
    const k = `${ei.egreso}|${item}`
    porEgresoItem.set(k, (porEgresoItem.get(k) || 0) + 1)
  })
  let multi = 0, maxLotes = 0
  porEgresoItem.forEach((n) => { if (n > 1) multi++; maxLotes = Math.max(maxLotes, n) })
  console.log(`  combinaciones egreso+item: ${porEgresoItem.size}`)
  console.log(`  con MAS DE UN lote: ${multi} (${((multi / porEgresoItem.size) * 100).toFixed(1)}%)`)
  console.log(`  maximo de lotes para un mismo item en un egreso: ${maxLotes}`)

  linea("7) ¿SALDOCANTIDAD ESTA AL DIA? (saldo guardado vs calculado)")
  const salidasPorLote = new Map()
  egrItems.forEach((ei) => salidasPorLote.set(ei.ingItem, (salidasPorLote.get(ei.ingItem) || 0) + (ei.cantidad || 0)))
  let ok = 0, dif = 0, ejemplos = []
  ingItems.forEach((ii) => {
    const calculado = (ii.cantidad || 0) - (salidasPorLote.get(ii.id) || 0)
    if (Math.abs(calculado - (ii.saldo ?? 0)) < 0.01) ok++
    else {
      dif++
      if (ejemplos.length < 5) ejemplos.push(`lote ${ii.id}: guardado=${ii.saldo} calculado=${calculado.toFixed(2)}`)
    }
  })
  console.log(`  coinciden: ${ok}   difieren: ${dif}`)
  ejemplos.forEach((e) => console.log(`    ${e}`))

  linea("8) LOTES CON SALDO (stock vivo) Y CANTIDADES FRACCIONARIAS")
  const conSaldo = ingItems.filter((ii) => (ii.saldo ?? 0) > 0).length
  const fraccion = ingItems.filter((ii) => ii.cantidad && ii.cantidad % 1 !== 0).length
  const precFraccion = ingItems.filter((ii) => ii.precio && (ii.precio * 100) % 1 !== 0).length
  console.log(`  lotes con saldo > 0: ${conSaldo} de ${ingItems.length}`)
  console.log(`  lineas con cantidad NO entera: ${fraccion}`)
  console.log(`  lineas con precio de mas de 2 decimales: ${precFraccion}`)

  linea("9) SALDOS INICIALES (observacion menciona gestion anterior)")
  const saldoIni = ingresos.filter((i) => /GESTION ANTERIOR|SALDO/i.test(i.obs || ""))
  console.log(`  ingresos que parecen saldo inicial: ${saldoIni.length}`)
  const porAnioSaldo = {}
  saldoIni.forEach((i) => { const a = anio(i.fecha); porAnioSaldo[a] = (porAnioSaldo[a] || 0) + 1 })
  console.log("  por gestion: " + JSON.stringify(porAnioSaldo))
})
