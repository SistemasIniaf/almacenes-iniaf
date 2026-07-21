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

const T = { ingresosalmacenes: [], ingresositems: [], codificadores: [], proveedores: [] }
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
  const codif = new Map(T.codificadores.map((v) => [n(v[0]), v[1]]))
  const prov = new Map(T.proveedores.map((v) => [n(v[0]), v[2]]))

  const ing = T.ingresosalmacenes.map((v) => ({
    id: n(v[0]), unidad: n(v[1]), proveedor: n(v[2]), fondo: n(v[3]), nro: n(v[4]),
    fecha: v[5] || "", obs: v[6], factura: v[8], tipo: n(v[14]),
    anio: (v[5] || "").slice(0, 4),
  }))
  const tipoNom = (t) => codif.get(t) ?? String(t)
  const linea = (t) => console.log("\n" + "=".repeat(72) + "\n" + t + "\n" + "=".repeat(72))

  linea("HIPOTESIS A: ¿cada TIPO tiene su propia numeracion?")
  // ¿el numero se repite dentro de unidad+gestion, pero NO dentro de unidad+gestion+tipo?
  let dupSinTipo = 0, dupConTipo = 0, gruposSinTipo = 0, gruposConTipo = 0
  const vistoSinTipo = new Map(), vistoConTipo = new Map()
  ing.filter((i) => i.anio >= "2020" && i.nro != null).forEach((i) => {
    const a = `${i.unidad}|${i.anio}|${i.nro}`
    const b = `${i.unidad}|${i.anio}|${i.tipo}|${i.nro}`
    vistoSinTipo.set(a, (vistoSinTipo.get(a) || 0) + 1)
    vistoConTipo.set(b, (vistoConTipo.get(b) || 0) + 1)
  })
  vistoSinTipo.forEach((k) => { gruposSinTipo++; if (k > 1) dupSinTipo++ })
  vistoConTipo.forEach((k) => { gruposConTipo++; if (k > 1) dupConTipo++ })
  console.log(`  numeros repetidos por unidad+gestion:        ${dupSinTipo} de ${gruposSinTipo} (${((dupSinTipo / gruposSinTipo) * 100).toFixed(1)}%)`)
  console.log(`  numeros repetidos por unidad+gestion+TIPO:   ${dupConTipo} de ${gruposConTipo} (${((dupConTipo / gruposConTipo) * 100).toFixed(1)}%)`)
  console.log("  -> si el segundo es ~0%, cada tipo lleva su propia numeracion")

  linea("EJEMPLO CONCRETO: unidad 152, gestion 2023, numeros por tipo")
  const ej = ing.filter((i) => i.unidad === 152 && i.anio === "2023").sort((a, b) => a.tipo - b.tipo || a.nro - b.nro)
  const porTipo = {}
  ej.forEach((i) => { (porTipo[i.tipo] = porTipo[i.tipo] || []).push(i.nro) })
  Object.entries(porTipo).forEach(([t, nros]) => {
    const unicos = new Set(nros)
    console.log(`  ${tipoNom(Number(t)).padEnd(20)} ${nros.length} ingresos, numeros ${Math.min(...nros)}..${Math.max(...nros)}, distintos: ${unicos.size}`)
  })

  linea("HIPOTESIS B: ¿el ingreso de SALDOS conserva el numero del ingreso original?")
  // Para saldos de 2026, buscar en gestiones anteriores un ingreso de la misma
  // unidad con misma factura y proveedor: ¿coincide el numero?
  const saldos2026 = ing.filter((i) => tipoNom(i.tipo) === "Ingreso saldos" && i.anio === "2026")
  const previos = ing.filter((i) => i.anio < "2026" && i.factura && i.factura.length > 2)
  const indice = new Map()
  previos.forEach((i) => {
    const k = `${i.unidad}|${i.proveedor}|${(i.factura || "").trim()}`
    if (!indice.has(k)) indice.set(k, [])
    indice.get(k).push(i)
  })
  let encontrados = 0, mismoNro = 0
  const muestras = []
  saldos2026.forEach((s) => {
    if (!s.factura || s.factura.length <= 2) return
    const k = `${s.unidad}|${s.proveedor}|${(s.factura || "").trim()}`
    const orig = indice.get(k)
    if (!orig || !orig.length) return
    encontrados++
    const coincide = orig.some((o) => o.nro === s.nro)
    if (coincide) mismoNro++
    else if (muestras.length < 6)
      muestras.push(`  saldo 2026 nro ${s.nro} <-> original ${orig[0].anio} nro ${orig[0].nro}   (factura ${s.factura}, ${prov.get(s.proveedor)})`)
  })
  console.log(`  saldos 2026 con original identificable: ${encontrados}`)
  console.log(`  de esos, conservan el MISMO numero:     ${mismoNro} (${encontrados ? ((mismoNro / encontrados) * 100).toFixed(1) : 0}%)`)
  muestras.forEach((m) => console.log(m))

  linea("HIPOTESIS C: ¿el numero se comparte con los EGRESOS? (numeracion unica de vales)")
  const nrosPorUnidad2026 = ing.filter((i) => i.anio === "2026" && i.unidad === 150).map((i) => i.nro).sort((a, b) => a - b)
  console.log(`  unidad 150, gestion 2026, numeros de ingreso ordenados (primeros 30):`)
  console.log("   " + nrosPorUnidad2026.slice(0, 30).join(", "))
  console.log(`   ... ultimos 10: ${nrosPorUnidad2026.slice(-10).join(", ")}`)
  const huecos = []
  for (let i = 1; i < Math.min(nrosPorUnidad2026.length, 200); i++) {
    const d = nrosPorUnidad2026[i] - nrosPorUnidad2026[i - 1]
    if (d > 1) huecos.push(d - 1)
  }
  console.log(`  huecos en la secuencia: ${huecos.length} (si hay muchos, el numero se comparte con otra cosa)`)

  linea("¿EL NUMERO ES POR UNIDAD O GLOBAL? (valores altos sueltos)")
  const altos = ing.filter((i) => i.anio >= "2024" && i.nro > 1000)
  console.log(`  ingresos 2024-2026 con numero > 1000: ${altos.length}`)
  const porTipoAlto = {}
  altos.forEach((i) => { porTipoAlto[tipoNom(i.tipo)] = (porTipoAlto[tipoNom(i.tipo)] || 0) + 1 })
  console.log("  por tipo: " + JSON.stringify(porTipoAlto))
  console.log("  muestra:")
  altos.slice(0, 8).forEach((i) =>
    console.log(`     unidad ${i.unidad} ${i.anio} nro ${i.nro} [${tipoNom(i.tipo)}] ${(i.obs || "").slice(0, 40)}`))
})
