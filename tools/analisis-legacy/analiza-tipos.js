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

const T = { ingresosalmacenes: [], ingresositems: [], itemsalmacenes: [], proveedores: [], codificadores: [], personal: [], unidades: [] }
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
  const vacio = (s) => !s || ["", "-", "0", "NULL", ".", "S/N"].includes(s.trim().toUpperCase())

  const prov = new Map(T.proveedores.map((v) => [n(v[0]), v[2]]))
  const codif = new Map(T.codificadores.map((v) => [n(v[0]), v[1]]))
  const nombreItem = new Map(T.itemsalmacenes.map((v) => [n(v[0]), v[3]]))

  const ing = T.ingresosalmacenes.map((v) => ({
    id: n(v[0]), unidad: n(v[1]), proveedor: n(v[2]), fondo: n(v[3]), nro: n(v[4]),
    fecha: v[5], obs: v[6], abierto: n(v[7]), factura: v[8], certificacion: v[9],
    proceso: v[10], notaRemision: v[11], solicitud: v[12], responsable: n(v[13]),
    tipo: n(v[14]), unidadSol: n(v[15]),
  }))

  const linea = (t) => console.log("\n" + "=".repeat(72) + "\n" + t + "\n" + "=".repeat(72))

  linea("1) COMO SE LLENA CADA TIPO DE INGRESO")
  const tipos = [...new Set(ing.map((i) => i.tipo))]
  console.log("tipo                       total  c/factura  c/notaRem  c/certif  c/proceso  c/solicitud  c/responsable")
  tipos.forEach((t) => {
    const filas = ing.filter((i) => i.tipo === t)
    const pct = (f) => {
      const k = filas.filter(f).length
      return `${((k / filas.length) * 100).toFixed(0)}%`.padStart(9)
    }
    const nombre = `${t} ${codif.get(t) ?? "?"}`.padEnd(26)
    console.log(
      nombre + String(filas.length).padStart(6) +
      pct((i) => !vacio(i.factura)) + pct((i) => !vacio(i.notaRemision)) +
      pct((i) => !vacio(i.certificacion)) + pct((i) => !vacio(i.proceso)) +
      pct((i) => !vacio(i.solicitud)) + pct((i) => i.responsable)
    )
  })

  linea("1b) PROVEEDORES MAS USADOS EN CADA TIPO")
  tipos.forEach((t) => {
    const filas = ing.filter((i) => i.tipo === t)
    const cuenta = {}
    filas.forEach((i) => { cuenta[i.proveedor] = (cuenta[i.proveedor] || 0) + 1 })
    const top = Object.entries(cuenta).sort((a, b) => b[1] - a[1]).slice(0, 4)
    console.log(`\n  ${t} ${codif.get(t)}:`)
    top.forEach(([p, k]) => console.log(`     ${String(k).padStart(5)}x  ${prov.get(Number(p)) ?? "?"}`))
  })

  linea("1c) POR GESTION Y TIPO (¿cuando se usa cada uno?)")
  const porAnioTipo = {}
  ing.forEach((i) => {
    const a = (i.fecha || "").slice(0, 4)
    porAnioTipo[a] = porAnioTipo[a] || {}
    porAnioTipo[a][i.tipo] = (porAnioTipo[a][i.tipo] || 0) + 1
  })
  console.log("gestion   " + tipos.map((t) => `${codif.get(t) ?? t}`.padStart(18)).join(""))
  Object.keys(porAnioTipo).sort().filter((a) => a >= "2020").forEach((a) => {
    console.log(a.padEnd(10) + tipos.map((t) => String(porAnioTipo[a][t] ?? 0).padStart(18)).join(""))
  })

  linea("1d) ¿EN QUE MES SE CARGAN LOS INGRESOS DE SALDOS?")
  const meses = {}
  ing.filter((i) => codif.get(i.tipo) === "Ingreso saldos").forEach((i) => {
    const m = (i.fecha || "").slice(5, 7)
    meses[m] = (meses[m] || 0) + 1
  })
  console.log("  " + Object.keys(meses).sort().map((m) => `mes ${m}: ${meses[m]}`).join("   "))

  linea("2) LAS DEVOLUCIONES, UNA POR UNA")
  const items = T.ingresositems.map((v) => ({ ing: n(v[1]), item: n(v[2]), cant: n(v[3]), precio: n(v[4]) }))
  const devol = ing.filter((i) => codif.get(i.tipo) === "Ingreso devolucion")
  devol.slice(0, 12).forEach((d) => {
    console.log(`\n  #${d.nro}  ${(d.fecha || "").slice(0, 10)}  proveedor: ${prov.get(d.proveedor) ?? "?"}`)
    console.log(`     observacion: ${d.obs || "(vacia)"}`)
    console.log(`     fuente: ${codif.get(d.fondo) ?? "?"}   nota remision: ${d.notaRemision || "-"}`)
    items.filter((it) => it.ing === d.id).slice(0, 4).forEach((it) =>
      console.log(`     · ${it.cant} x ${(nombreItem.get(it.item) || "?").slice(0, 45)}  @ Bs ${it.precio}`))
  })
  console.log(`\n  (total devoluciones: ${devol.length})`)

  linea("7) FECHAS: la tabla de ingresos solo tiene UNA columna de fecha (FECHA)")
  const conFecha = ing.filter((i) => i.fecha && i.fecha !== "NULL")
  console.log(`  ingresos con fecha valida: ${conFecha.length} de ${ing.length}`)
  console.log("  ejemplos de valores:")
  conFecha.slice(0, 5).forEach((i) => console.log(`     ${i.fecha}`))
  const conHora = conFecha.filter((i) => !i.fecha.endsWith("00:00:00")).length
  console.log(`  con hora distinta de 00:00:00: ${conHora} (si es ~0, la fecha se carga a mano, no es del sistema)`)

  linea("8) NUMEROS DE INGRESO: valores reales")
  const recientes = ing.filter((i) => (i.fecha || "") >= "2026").sort((a, b) => a.unidad - b.unidad || a.nro - b.nro)
  recientes.slice(0, 15).forEach((i) =>
    console.log(`  unidad ${String(i.unidad).padStart(4)}  nro ${String(i.nro).padStart(6)}  ${(i.fecha || "").slice(0, 10)}  ${(prov.get(i.proveedor) || "").slice(0, 30)}`))

  linea("EXTRA) RESPONSABLE: ¿de donde sale?")
  const pers = new Map(T.personal.map((v) => [n(v[0]), v]))
  console.log(`  filas en tabla personal: ${T.personal.length}`)
  const respUsados = new Set(ing.map((i) => i.responsable).filter(Boolean))
  console.log(`  responsables distintos usados en ingresos: ${respUsados.size}`)
  ;[...respUsados].slice(0, 5).forEach((r) => {
    const p = pers.get(r)
    console.log(`     id ${r}: ${p ? p.slice(2, 7).filter(Boolean).join(" ") : "(no esta en personal)"}`)
  })
})
