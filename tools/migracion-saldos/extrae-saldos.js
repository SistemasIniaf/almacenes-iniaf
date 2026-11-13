// Extrae del sistema anterior los LOTES CON SALDO y arma la planilla de
// migracion de saldos iniciales (ver README.md de esta carpeta).
//
//   node extrae-saldos.js <dump.sql> <gestion> <salida.xlsx>
//
// Solo lectura: parsea el volcado MySQL como texto, no levanta ninguna base.
//
// Por que la gestion y no "todos los lotes": el cierre del sistema anterior
// DUPLICA cada año los lotes con saldo como «Ingreso saldos» (tipo 39, fechado
// el 2/1). Los lotes vivos son, por lo tanto, los ingresos de la ultima
// gestion; los de gestiones anteriores ya fueron trasladados.
//
// El saldo se RECALCULA (cantidad − salidas despachadas de egresos aprobados).
// No se usa SALDOCANTIDAD: esta desincronizado en la mayoria de los lotes.
const fs = require("fs")
const path = require("path")
const readline = require("readline")
const ExcelJS = require("exceljs")

const [RUTA_DUMP, GESTION, RUTA_SALIDA] = process.argv.slice(2)
if (!RUTA_DUMP || !/^\d{4}$/.test(GESTION ?? "") || !RUTA_SALIDA) {
  console.error("Uso: node extrae-saldos.js <dump.sql> <gestion> <salida.xlsx>")
  process.exit(1)
}

// Estados de egresosalmacenes (tabla codificadores del sistema anterior).
// NULL = egresos de 2015-2017, anteriores al circuito con estados: eran
// salidas efectivas.
const ESTADO_APROBADO = 106
const ESTADOS_PENDIENTES = new Set([104, 105, 109, 112]) // solicitado, verificado, solicitud aprobada/enviada
const TIPO_SALDOS = 39 // «Ingreso saldos» = apertura de gestion

// Fuentes del sistema nuevo, para sugerir la correspondencia por nombre.
const FUENTES_NUEVAS = [
  ...fs
    .readFileSync(path.join(__dirname, "../../backend/prisma/data/fuentes-iniaf.ts"), "utf8")
    .matchAll(/^\s*'([^']+)',/gm),
].map((m) => m[1])

// --- Parseo del volcado --------------------------------------------------

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
    } else if (c === "'") enComilla = true
    else if (c === ",") { campos.push(actual.trim()); actual = "" }
    else actual += c
  }
  campos.push(actual.trim())
  return campos
}

const TABLAS = {
  ingresosalmacenes: [], ingresositems: [], egresosalmacenes: [],
  egresositems: [], itemsalmacenes: [], codificadores: [], unidades: [], proveedores: [],
}

const rl = readline.createInterface({
  // El volcado declara utf8 pero lo que hay adentro es latin1 (las tildes
  // salen bien asi; leido como utf8 aparecen como «�»).
  input: fs.createReadStream(RUTA_DUMP, { encoding: "latin1" }),
  crlfDelay: Infinity,
})
rl.on("line", (linea) => {
  const m = linea.match(/^INSERT INTO `([a-z]+)` VALUES /)
  if (!m || !(m[1] in TABLAS)) return
  const v = parseValores(linea)
  if (v) TABLAS[m[1]].push(v)
})
rl.on("close", () => armar().catch((e) => { console.error(e); process.exit(1) }))

// --- Calculo ---------------------------------------------------------------

const nulo = (v) => v == null || v === "NULL" || v === ""
const num = (v) => (nulo(v) ? null : Number(v))
const txt = (v) => (nulo(v) ? "" : v.replace(/\s+/g, " ").trim())
const normalizar = (s) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, " ").trim()
const redondear = (n) => Math.round(n * 100) / 100

async function armar() {
  const codif = new Map(TABLAS.codificadores.map((v) => [num(v[0]), txt(v[1])]))
  const unidades = new Map(
    TABLAS.unidades.map((v) => [num(v[0]), { nombre: txt(v[1]), padre: num(v[3]) }]),
  )
  const proveedores = new Map(TABLAS.proveedores.map((v) => [num(v[0]), { nombre: txt(v[2]), nit: txt(v[4]) }]))
  const items = new Map(
    TABLAS.itemsalmacenes.map((v) => [
      num(v[0]),
      { id: num(v[0]), partida: num(v[1]), codigo: num(v[2]), descripcion: txt(v[3]), unidad: txt(v[4]) },
    ]),
  )
  const ingresos = new Map(
    TABLAS.ingresosalmacenes.map((v) => [
      num(v[0]),
      {
        id: num(v[0]), unidad: num(v[1]), proveedor: num(v[2]), fondo: num(v[3]), numero: num(v[4]),
        fecha: txt(v[5]).slice(0, 10), observacion: txt(v[6]), factura: txt(v[8]),
        certificacion: txt(v[9]), proceso: txt(v[10]), notaRemision: txt(v[11]), tipo: num(v[14]),
      },
    ]),
  )
  const egresos = new Map(TABLAS.egresosalmacenes.map((v) => [num(v[0]), num(v[10])]))

  // Salidas por lote: las efectivas restan; las pendientes solo se informan.
  const salidas = new Map()
  const pendientes = new Map()
  for (const v of TABLAS.egresositems) {
    const estado = egresos.get(num(v[1]))
    const lote = num(v[2])
    if (estado === ESTADO_APROBADO || estado === null) {
      salidas.set(lote, (salidas.get(lote) ?? 0) + (num(v[3]) ?? 0))
    } else if (ESTADOS_PENDIENTES.has(estado)) {
      const p = pendientes.get(lote) ?? { pedidos: 0, cantidad: 0 }
      p.pedidos++
      p.cantidad += num(v[4]) ?? num(v[3]) ?? 0
      pendientes.set(lote, p)
    }
  }

  const nombreAlmacen = (id) => {
    const u = unidades.get(id)
    if (!u) return `(unidad ${id})`
    const padre = u.padre != null && u.padre !== id ? unidades.get(u.padre) : null
    return padre ? `${u.nombre} — ${padre.nombre}` : u.nombre
  }

  const lotes = []
  const revisar = []
  for (const v of TABLAS.ingresositems) {
    const id = num(v[0])
    const ing = ingresos.get(num(v[1]))
    if (!ing || !ing.fecha.startsWith(GESTION)) continue
    const item = items.get(num(v[2]))
    const cantidad = num(v[3]) ?? 0
    const precio = num(v[4]) ?? 0
    const salido = redondear(salidas.get(id) ?? 0)
    const saldo = redondear(cantidad - salido)
    const pend = pendientes.get(id)
    const alertas = []
    if (!item) alertas.push("ÍTEM INEXISTENTE EN EL CATÁLOGO VIEJO")
    if (precio <= 0) alertas.push("PRECIO EN CERO")
    if (pend) alertas.push(`${pend.pedidos} PEDIDO(S) PENDIENTE(S) POR ${redondear(pend.cantidad)}`)
    const fila = {
      loteId: id, almacenId: ing.unidad, almacen: nombreAlmacen(ing.unidad),
      ingresoId: ing.id,
      tipo: ing.tipo === TIPO_SALDOS ? "SALDO GESTIÓN ANTERIOR" : "COMPRA",
      numero: ing.numero, fecha: ing.fecha,
      itemId: item?.id ?? num(v[2]), descripcion: item?.descripcion ?? "", unidadMedida: item?.unidad ?? "",
      partida: item?.partida ?? null, observacion: txt(v[7]),
      fondoId: ing.fondo, fuente: codif.get(ing.fondo) ?? `(fondo ${ing.fondo})`,
      proveedor: proveedores.get(ing.proveedor)?.nombre ?? "", nit: proveedores.get(ing.proveedor)?.nit ?? "",
      factura: ing.factura, proceso: ing.proceso, certificacion: ing.certificacion, notaRemision: ing.notaRemision,
      cantidad, salido, saldo, precio, valor: redondear(saldo * precio),
      alerta: alertas.join(" · "),
    }
    if (saldo < 0) {
      revisar.push({ ...fila, alerta: ["SALIDAS MAYORES AL INGRESO", ...alertas].join(" · ") })
    } else if (saldo > 0) {
      lotes.push(fila)
    }
  }
  lotes.sort((a, b) => a.almacen.localeCompare(b.almacen) || a.descripcion.localeCompare(b.descripcion) || a.loteId - b.loteId)

  // Resumenes para las hojas de correspondencia.
  const agrupar = (clave, extra) => {
    const m = new Map()
    for (const l of lotes) {
      const k = clave(l)
      const g = m.get(k) ?? { ...extra(l), lotes: 0, valor: 0, cantidad: 0, almacenes: new Set() }
      g.lotes++
      g.valor += l.valor
      g.cantidad += l.saldo
      g.almacenes.add(l.almacenId)
      m.set(k, g)
    }
    return [...m.values()]
  }
  const almacenes = agrupar((l) => l.almacenId, (l) => ({ id: l.almacenId, nombre: l.almacen }))
    .sort((a, b) => b.valor - a.valor)
  const fuentes = agrupar((l) => l.fondoId, (l) => ({ id: l.fondoId, nombre: l.fuente }))
    .sort((a, b) => b.valor - a.valor)
  const itemsConSaldo = agrupar((l) => l.itemId, (l) => ({
    id: l.itemId, codigo: items.get(l.itemId)?.codigo ?? null, descripcion: l.descripcion,
    unidadMedida: l.unidadMedida, partida: l.partida,
  })).sort((a, b) => a.descripcion.localeCompare(b.descripcion) || a.id - b.id)

  // Posibles duplicados: misma descripcion normalizada (el catalogo viejo
  // tiene el mismo ítem cargado varias veces). Se numeran los grupos.
  const porDescripcion = new Map()
  for (const it of itemsConSaldo) {
    const k = normalizar(it.descripcion)
    porDescripcion.set(k, [...(porDescripcion.get(k) ?? []), it])
  }
  let grupo = 0
  for (const lista of porDescripcion.values()) {
    if (lista.length > 1) {
      grupo++
      for (const it of lista) it.duplicado = grupo
    }
  }

  const fuentePorNombre = new Map(FUENTES_NUEVAS.map((f) => [normalizar(f), f]))
  for (const f of fuentes) f.sugerida = fuentePorNombre.get(normalizar(f.nombre)) ?? ""

  await escribir({ lotes, revisar, almacenes, fuentes, itemsConSaldo })

  const total = lotes.reduce((s, l) => s + l.valor, 0)
  console.log(`Gestión ${GESTION}: ${lotes.length} lotes con saldo · ${itemsConSaldo.length} ítems · ` +
    `${almacenes.length} almacenes · ${fuentes.length} fuentes · Bs ${total.toFixed(2)}`)
  console.log(`Para revisar (salidas mayores al ingreso): ${revisar.length} · grupos de posibles duplicados: ${grupo}`)
  console.log(`Fuentes sin correspondencia automática: ${fuentes.filter((f) => !f.sugerida).map((f) => f.nombre).join(", ") || "ninguna"}`)
  console.log(`Escrito: ${path.resolve(RUTA_SALIDA)}`)
}

// --- Excel -------------------------------------------------------------------

const MONEDA = "#,##0.00"
const CANTIDAD = "#,##0.##"
const PRECIO = "#,##0.00###"
const RELLENAR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } } // amarillo: lo que hay que llenar

function hoja(libro, nombre, columnas, filas, { rellenar = [] } = {}) {
  const ws = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] })
  ws.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho ?? 14, style: c.formato ? { numFmt: c.formato } : {} }))
  for (const f of filas) ws.addRow(f)
  const encabezado = ws.getRow(1)
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } }
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E6B3F" } }
  encabezado.alignment = { vertical: "middle", wrapText: true }
  encabezado.height = 30
  for (const clave of rellenar) {
    const col = ws.getColumn(clave)
    col.eachCell((celda, n) => { if (n > 1) celda.fill = RELLENAR })
    ws.getCell(1, col.number).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB45F06" } }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }
  return ws
}

async function escribir({ lotes, revisar, almacenes, fuentes, itemsConSaldo }) {
  const libro = new ExcelJS.Workbook()
  libro.creator = "Sistema de Almacenes INIAF — migración de saldos"
  // ExcelJS escribe las formulas sin resultado: que Excel las calcule al abrir.
  libro.calcProperties.fullCalcOnLoad = true

  const leeme = libro.addWorksheet("LÉAME")
  const texto = [
    `MIGRACIÓN DE SALDOS INICIALES — gestión ${GESTION} del sistema anterior`,
    "",
    "Esta planilla la genera tools/migracion-saldos/extrae-saldos.js. NO se cargan datos a mano en la hoja LOTES:",
    "solo se completan las columnas en AMARILLO de las tres hojas de correspondencia.",
    "",
    "1. ALMACENES — a qué almacén del sistema nuevo pasa cada almacén viejo (pueden juntarse varios en uno).",
    "2. FUENTES — a qué fuente del sistema nuevo corresponde cada una. La mayoría ya viene sugerida por nombre.",
    "3. ÍTEMS — el código del ítem en el catálogo NUEVO. Es lo que más trabajo lleva.",
    "   «Posible duplicado» marca con el mismo número los ítems viejos con igual descripción:",
    "   normalmente van al MISMO código nuevo.",
    "",
    "LOTES es el detalle que se va a importar: un renglón por lote con saldo. Las tres columnas de la derecha",
    "muestran la correspondencia que resulta de las hojas anteriores (se calculan solas).",
    "PARA REVISAR son lotes con más salidas que ingreso en el sistema viejo: NO se migran salvo que se corrijan.",
    "",
    "El saldo se recalculó: cantidad ingresada − cantidades despachadas en egresos aprobados.",
    "Los pedidos pendientes NO restan, pero se avisan en la columna Alerta: conviene resolverlos antes del corte.",
  ]
  texto.forEach((t, i) => { leeme.getCell(i + 1, 1).value = t })
  leeme.getCell(1, 1).font = { bold: true, size: 14 }
  leeme.getColumn(1).width = 110

  hoja(libro, "ALMACENES", [
    { titulo: "Id viejo", clave: "id", ancho: 9 },
    { titulo: "Almacén en el sistema anterior", clave: "nombre", ancho: 45 },
    { titulo: "Lotes", clave: "lotes", ancho: 8 },
    { titulo: "Valor Bs", clave: "valor", ancho: 16, formato: MONEDA },
    { titulo: "ALMACÉN NUEVO", clave: "nuevo", ancho: 45 },
  ], almacenes, { rellenar: ["nuevo"] })

  const wsFuentes = hoja(libro, "FUENTES", [
    { titulo: "Id viejo", clave: "id", ancho: 9 },
    { titulo: "Fuente en el sistema anterior", clave: "nombre", ancho: 32 },
    { titulo: "Lotes", clave: "lotes", ancho: 8 },
    { titulo: "Valor Bs", clave: "valor", ancho: 16, formato: MONEDA },
    { titulo: "FUENTE NUEVA", clave: "sugerida", ancho: 32 },
  ], fuentes, { rellenar: ["sugerida"] })
  // Lista desplegable con las fuentes del sistema nuevo (hoja oculta).
  const listas = libro.addWorksheet("listas", { state: "hidden" })
  FUENTES_NUEVAS.forEach((f, i) => { listas.getCell(i + 1, 1).value = f })
  for (let r = 2; r <= fuentes.length + 1; r++) {
    wsFuentes.getCell(r, 5).dataValidation = {
      type: "list", allowBlank: true, formulae: [`listas!$A$1:$A$${FUENTES_NUEVAS.length}`],
    }
  }

  hoja(libro, "ÍTEMS", [
    { titulo: "Id viejo", clave: "id", ancho: 9 },
    { titulo: "Código viejo", clave: "codigo", ancho: 10 },
    { titulo: "Descripción", clave: "descripcion", ancho: 50 },
    { titulo: "Unidad", clave: "unidadMedida", ancho: 12 },
    { titulo: "Partida", clave: "partida", ancho: 9 },
    { titulo: "Posible duplicado", clave: "duplicado", ancho: 10 },
    { titulo: "Lotes", clave: "lotes", ancho: 7 },
    { titulo: "Saldo total", clave: "cantidad", ancho: 11, formato: CANTIDAD },
    { titulo: "Valor Bs", clave: "valor", ancho: 14, formato: MONEDA },
    { titulo: "Almacenes", clave: "nAlmacenes", ancho: 10 },
    { titulo: "CÓDIGO ÍTEM NUEVO", clave: "nuevo", ancho: 20 },
  ], itemsConSaldo.map((i) => ({ ...i, nAlmacenes: i.almacenes.size })), { rellenar: ["nuevo"] })

  const columnasLote = [
    { titulo: "Id lote viejo", clave: "loteId", ancho: 10 },
    { titulo: "Id almacén", clave: "almacenId", ancho: 8 },
    { titulo: "Almacén", clave: "almacen", ancho: 30 },
    { titulo: "Id ingreso viejo", clave: "ingresoId", ancho: 9 },
    { titulo: "Origen", clave: "tipo", ancho: 14 },
    { titulo: "Nº ingreso", clave: "numero", ancho: 9 },
    { titulo: "Fecha ingreso", clave: "fecha", ancho: 11 },
    { titulo: "Id ítem", clave: "itemId", ancho: 8 },
    { titulo: "Descripción", clave: "descripcion", ancho: 40 },
    { titulo: "Unidad", clave: "unidadMedida", ancho: 10 },
    { titulo: "Partida", clave: "partida", ancho: 8 },
    { titulo: "Observación de la línea", clave: "observacion", ancho: 24 },
    { titulo: "Id fuente", clave: "fondoId", ancho: 7 },
    { titulo: "Fuente", clave: "fuente", ancho: 18 },
    { titulo: "Proveedor", clave: "proveedor", ancho: 24 },
    { titulo: "NIT", clave: "nit", ancho: 12 },
    { titulo: "Factura", clave: "factura", ancho: 10 },
    { titulo: "Proceso / C31", clave: "proceso", ancho: 12 },
    { titulo: "Certificación", clave: "certificacion", ancho: 12 },
    { titulo: "Nota remisión", clave: "notaRemision", ancho: 12 },
    { titulo: "Cant. ingresada", clave: "cantidad", ancho: 10, formato: CANTIDAD },
    { titulo: "Salidas", clave: "salido", ancho: 10, formato: CANTIDAD },
    { titulo: "SALDO", clave: "saldo", ancho: 10, formato: CANTIDAD },
    { titulo: "Precio unit.", clave: "precio", ancho: 12, formato: PRECIO },
    { titulo: "Valor Bs", clave: "valor", ancho: 14, formato: MONEDA },
    { titulo: "Alerta", clave: "alerta", ancho: 30 },
  ]
  const wsLotes = hoja(libro, "LOTES", [
    ...columnasLote,
    { titulo: "→ Almacén nuevo", clave: "_a", ancho: 30 },
    { titulo: "→ Fuente nueva", clave: "_f", ancho: 20 },
    { titulo: "→ Código ítem nuevo", clave: "_i", ancho: 18 },
  ], lotes)
  // La correspondencia resultante, para revisar cada lote sin saltar de hoja.
  const col = (clave) => wsLotes.getColumn(clave).letter
  const [cAlm, cFon, cIt] = [col("almacenId"), col("fondoId"), col("itemId")]
  for (let r = 2; r <= lotes.length + 1; r++) {
    // Celda vacia en la hoja de correspondencia = todavia sin asignar ("").
    const buscar = (celda, hojaNombre, colRes, indice) => {
      const v = `VLOOKUP(${celda}${r},'${hojaNombre}'!$A:${colRes},${indice},FALSE)`
      return { formula: `IFERROR(IF(${v}="","",${v}),"")` }
    }
    wsLotes.getCell(`${col("_a")}${r}`).value = buscar(cAlm, "ALMACENES", "E", 5)
    wsLotes.getCell(`${col("_f")}${r}`).value = buscar(cFon, "FUENTES", "E", 5)
    wsLotes.getCell(`${col("_i")}${r}`).value = buscar(cIt, "ÍTEMS", "K", 11)
  }
  // Total del valor al pie, para cotejar contra la importacion.
  const filaTotal = wsLotes.addRow({ descripcion: "TOTAL", valor: { formula: `SUBTOTAL(9,${col("valor")}2:${col("valor")}${lotes.length + 1})` } })
  filaTotal.font = { bold: true }

  hoja(libro, "PARA REVISAR", columnasLote, revisar)

  await libro.xlsx.writeFile(RUTA_SALIDA)
}
