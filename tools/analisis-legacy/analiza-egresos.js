// Analiza los EGRESOS del sistema viejo: circuito de aprobacion, ajuste de
// cantidades, actividad/destino y de que lotes sale el material.
// Solo lectura sobre el volcado MySQL; no hace falta levantar ninguna base.
const fs = require("fs")
const readline = require("readline")

const RUTA = process.argv[2]
if (!RUTA) {
  console.error("Uso: node analiza-egresos.js <ruta-al-dump.sql>")
  process.exit(1)
}

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
  egresosalmacenes: [],
  egresositems: [],
  ingresositems: [],
  codificadores: [],
  categorias: [],
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
  const nulo = (v) => v == null || v === "NULL" || v === ""
  const num = (v) => (nulo(v) ? null : Number(v))
  const txt = (v) => (nulo(v) ? null : v)
  const anio = (f) => (nulo(f) ? "?" : f.slice(0, 4))
  const pct = (parte, total) =>
    total ? `${((parte / total) * 100).toFixed(1)}%` : "—"

  // egresosalmacenes: id,unidad,persona,fecha,pedido,observacion,abierto,
  //                   categoria,actividad,observaciones,estado,verificador,
  //                   fechaverif,aprobador,fechaaprob,aprobadorsol
  const egresos = TABLAS.egresosalmacenes.map((f) => ({
    id: num(f[0]),
    unidad: num(f[1]),
    persona: num(f[2]),
    fecha: txt(f[3]),
    pedido: num(f[4]),
    abierto: num(f[6]),
    categoria: num(f[7]),
    actividad: txt(f[8]),
    estado: num(f[10]),
    verificador: num(f[11]),
    fechaVerif: txt(f[12]),
    aprobador: num(f[13]),
    fechaAprob: txt(f[14]),
    aprobadorSol: num(f[15]),
  }))

  const lineas = TABLAS.egresositems.map((f) => ({
    id: num(f[0]),
    egreso: num(f[1]),
    lote: num(f[2]),
    cantidad: num(f[3]),
    solicitada: num(f[4]),
  }))

  // codificadores: id, ..., descripcion (se busca la primera columna de texto)
  const codificador = new Map()
  for (const f of TABLAS.codificadores) {
    const id = num(f[0])
    const desc = f.find((v, i) => i > 0 && !nulo(v) && Number.isNaN(Number(v)))
    if (id != null) codificador.set(id, desc ?? String(id))
  }
  const categoria = new Map()
  for (const f of TABLAS.categorias) {
    const id = num(f[0])
    const desc = f.find((v, i) => i > 0 && !nulo(v) && Number.isNaN(Number(v)))
    if (id != null) categoria.set(id, desc ?? String(id))
  }

  const total = egresos.length
  const titulo = (t) => console.log(`\n${"=".repeat(70)}\n${t}\n${"=".repeat(70)}`)
  const cuenta = (mapa, top = 12) =>
    [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)

  titulo("VOLUMEN")
  console.log(`egresos: ${total}   lineas: ${lineas.length}`)
  const porAnio = new Map()
  for (const e of egresos) porAnio.set(anio(e.fecha), (porAnio.get(anio(e.fecha)) ?? 0) + 1)
  for (const [a, n] of [...porAnio.entries()].sort())
    console.log(`  ${a}: ${String(n).padStart(6)}`)

  titulo("CIRCUITO DE APROBACION — ¿cuantos casilleros se usan de verdad?")
  const conVerificador = egresos.filter((e) => e.verificador != null).length
  const conAprobador = egresos.filter((e) => e.aprobador != null).length
  const conAprobSol = egresos.filter((e) => e.aprobadorSol != null).length
  const conLosTres = egresos.filter(
    (e) => e.verificador != null && e.aprobador != null && e.aprobadorSol != null,
  ).length
  const sinNinguno = egresos.filter(
    (e) => e.verificador == null && e.aprobador == null && e.aprobadorSol == null,
  ).length
  console.log(`con verificador   : ${conVerificador} (${pct(conVerificador, total)})`)
  console.log(`con aprobador     : ${conAprobador} (${pct(conAprobador, total)})`)
  console.log(`con aprobadorSol  : ${conAprobSol} (${pct(conAprobSol, total)})`)
  console.log(`con los TRES      : ${conLosTres} (${pct(conLosTres, total)})`)
  console.log(`sin ninguno       : ${sinNinguno} (${pct(sinNinguno, total)})`)

  // Desde que gestion se empieza a usar cada firma (dice si el circuito es
  // nuevo). Se ignoran los años basura del volcado: hay filas con 0000 y 0215.
  const primerUso = (campo) => {
    const anios = egresos
      .filter((e) => e[campo] != null)
      .map((e) => anio(e.fecha))
      .filter((a) => a >= "2010" && a <= "2030")
      .sort()
    return anios[0] ?? "nunca"
  }
  console.log(
    `primera gestion con verificador: ${primerUso("verificador")} · con aprobador: ${primerUso("aprobador")} · con aprobadorSol: ${primerUso("aprobadorSol")}`,
  )

  titulo("ESTADOS")
  const porEstado = new Map()
  for (const e of egresos) {
    const k = e.estado == null ? "(sin estado)" : `${e.estado} ${codificador.get(e.estado) ?? ""}`
    porEstado.set(k, (porEstado.get(k) ?? 0) + 1)
  }
  for (const [k, n] of cuenta(porEstado)) console.log(`  ${String(n).padStart(6)}  ${k}`)

  console.log("\nIDABIERTO (el otro codificador de la cabecera):")
  const porAbierto = new Map()
  for (const e of egresos) {
    const k = e.abierto == null ? "(nulo)" : `${e.abierto} ${codificador.get(e.abierto) ?? ""}`
    porAbierto.set(k, (porAbierto.get(k) ?? 0) + 1)
  }
  for (const [k, n] of cuenta(porAbierto)) console.log(`  ${String(n).padStart(6)}  ${k}`)

  titulo("¿LAS TRES FIRMAS SON PERSONAS DISTINTAS?")
  const conFirmas = egresos.filter((e) => e.verificador != null || e.aprobador != null)
  const verifIgualAprob = conFirmas.filter((e) => e.verificador === e.aprobador).length
  const lasTresIguales = conFirmas.filter(
    (e) =>
      e.verificador != null &&
      e.verificador === e.aprobador &&
      e.aprobador === e.aprobadorSol,
  ).length
  const algunaDistinta = conFirmas.filter(
    (e) => e.verificador !== e.aprobador,
  ).length
  console.log(`egresos con alguna firma: ${conFirmas.length}`)
  console.log(`  verificador == aprobador : ${verifIgualAprob} (${pct(verifIgualAprob, conFirmas.length)})`)
  console.log(`  las TRES son la misma    : ${lasTresIguales} (${pct(lasTresIguales, conFirmas.length)})`)
  console.log(`  verificador != aprobador : ${algunaDistinta} (${pct(algunaDistinta, conFirmas.length)})`)

  titulo("¿LAS FECHAS DE FIRMA SON REALES?")
  const valoresVerif = new Map()
  const valoresAprob = new Map()
  for (const e of egresos) {
    if (e.fechaVerif) valoresVerif.set(e.fechaVerif, (valoresVerif.get(e.fechaVerif) ?? 0) + 1)
    if (e.fechaAprob) valoresAprob.set(e.fechaAprob, (valoresAprob.get(e.fechaAprob) ?? 0) + 1)
  }
  console.log(`valores distintos de FECHAVERIFICACION: ${valoresVerif.size}`)
  for (const [v, n] of cuenta(valoresVerif, 5)) console.log(`  ${String(n).padStart(6)}  ${v}`)
  console.log(`valores distintos de FECHAAPROBACION: ${valoresAprob.size}`)
  for (const [v, n] of cuenta(valoresAprob, 5)) console.log(`  ${String(n).padStart(6)}  ${v}`)

  titulo("TIEMPOS — cuanto tarda cada paso (SLA real)")
  const dias = (a, b) => {
    if (nulo(a) || nulo(b)) return null
    const d = (new Date(b) - new Date(a)) / 86400000
    return Number.isFinite(d) ? d : null
  }
  const resumirDias = (etiqueta, valores) => {
    const v = valores.filter((x) => x != null && x >= 0).sort((a, b) => a - b)
    if (!v.length) return console.log(`${etiqueta}: sin datos`)
    const mediana = v[Math.floor(v.length / 2)]
    const p90 = v[Math.floor(v.length * 0.9)]
    console.log(
      `${etiqueta}: n=${v.length}  mediana ${mediana.toFixed(0)} d  p90 ${p90.toFixed(0)} d  max ${v[v.length - 1].toFixed(0)} d  · mismo dia: ${pct(v.filter((x) => x < 1).length, v.length)}`,
    )
  }
  resumirDias("pedido → verificacion", egresos.map((e) => dias(e.fecha, e.fechaVerif)))
  resumirDias("verificacion → aprobacion", egresos.map((e) => dias(e.fechaVerif, e.fechaAprob)))
  resumirDias("pedido → aprobacion", egresos.map((e) => dias(e.fecha, e.fechaAprob)))

  titulo("ACTIVIDAD / DESTINO — ¿lo llenan?")
  const conActividad = egresos.filter((e) => e.actividad && e.actividad.trim()).length
  console.log(`con actividad: ${conActividad} (${pct(conActividad, total)})`)
  const largos = egresos
    .filter((e) => e.actividad)
    .map((e) => e.actividad.trim().length)
    .sort((a, b) => a - b)
  if (largos.length)
    console.log(
      `largo: mediana ${largos[Math.floor(largos.length / 2)]} · max ${largos[largos.length - 1]} caracteres`,
    )
  console.log("ejemplos:")
  for (const e of egresos.filter((x) => x.actividad).slice(-6))
    console.log(`  «${e.actividad.trim().slice(0, 110)}»`)

  const conCategoria = egresos.filter((e) => e.categoria != null).length
  console.log(`\ncon categoria: ${conCategoria} (${pct(conCategoria, total)})`)
  const porCat = new Map()
  for (const e of egresos.filter((x) => x.categoria != null)) {
    const k = `${e.categoria} ${categoria.get(e.categoria) ?? ""}`
    porCat.set(k, (porCat.get(k) ?? 0) + 1)
  }
  for (const [k, n] of cuenta(porCat)) console.log(`  ${String(n).padStart(6)}  ${k}`)

  titulo("AJUSTE DE CANTIDAD — ¿se entrega menos de lo pedido?")
  const conSolicitada = lineas.filter((l) => l.solicitada != null)
  const recortadas = conSolicitada.filter((l) => l.cantidad < l.solicitada)
  const iguales = conSolicitada.filter((l) => l.cantidad === l.solicitada)
  const ampliadas = conSolicitada.filter((l) => l.cantidad > l.solicitada)
  console.log(`lineas con cantidadsolicitada cargada: ${conSolicitada.length} de ${lineas.length} (${pct(conSolicitada.length, lineas.length)})`)
  console.log(`  se entrego lo pedido : ${iguales.length} (${pct(iguales.length, conSolicitada.length)})`)
  console.log(`  se entrego MENOS     : ${recortadas.length} (${pct(recortadas.length, conSolicitada.length)})`)
  console.log(`  se entrego MAS       : ${ampliadas.length} (${pct(ampliadas.length, conSolicitada.length)})`)
  const enCero = conSolicitada.filter((l) => l.cantidad === 0)
  console.log(`  se entrego CERO      : ${enCero.length} (${pct(enCero.length, conSolicitada.length)})`)

  titulo("DE QUE LOTE SALE — ¿un pedido toca varios lotes del mismo item?")
  // Cada linea apunta a un lote; se agrupa por egreso + item del lote.
  const itemDeLote = new Map()
  for (const f of TABLAS.ingresositems) {
    const id = num(f[0])
    // ingresositems: id, ingreso, item, cantidad, precio, ...
    if (id != null) itemDeLote.set(id, num(f[2]))
  }
  const porEgresoItem = new Map()
  for (const l of lineas) {
    const item = itemDeLote.get(l.lote)
    if (item == null) continue
    const k = `${l.egreso}|${item}`
    porEgresoItem.set(k, (porEgresoItem.get(k) ?? 0) + 1)
  }
  const combos = [...porEgresoItem.values()]
  const multi = combos.filter((n) => n > 1)
  console.log(`combinaciones egreso+item: ${combos.length}`)
  console.log(`  con MAS de un lote: ${multi.length} (${pct(multi.length, combos.length)})`)
  // `Math.max(...combos)` desborda la pila con 180k elementos.
  const maxLotes = combos.reduce((m, n) => (n > m ? n : m), 0)
  console.log(`  maximo de lotes en una sola salida de un item: ${maxLotes}`)

  titulo("NUMERACION (campo PEDIDO)")
  const porUnidadPedido = new Map()
  for (const e of egresos) {
    const k = `${e.unidad}|${anio(e.fecha)}|${e.pedido}`
    porUnidadPedido.set(k, (porUnidadPedido.get(k) ?? 0) + 1)
  }
  const repetidos = [...porUnidadPedido.values()].filter((n) => n > 1).length
  console.log(`numeros repetidos dentro de unidad+gestion: ${repetidos} de ${porUnidadPedido.size} (${pct(repetidos, porUnidadPedido.size)})`)
  const sinPedido = egresos.filter((e) => e.pedido == null || e.pedido === 0).length
  console.log(`sin numero o en cero: ${sinPedido}`)
})
