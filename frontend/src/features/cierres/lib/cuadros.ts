import type { DatosCuadros, FilaCuadro } from "@/features/cierres/cierres.types"

/**
 * Lo común a los Cuadros 5 y 6 (DGCF R1.05 / R1.06), en PDF y en Excel.
 *
 * No son el documento oficial: el Ministerio le manda a almacenes su planilla y
 * estos cuadros son el MODELO para llenarla con los datos del sistema
 * (decisión del 2026-11-16). Por eso replican las columnas de la planilla tal
 * cual, y lo que importa es que las cifras cuadren: el Cuadro 5 se arma
 * sumando las filas del 6, así los dos coinciden por construcción.
 */

export type NumeroCuadro = 5 | 6

export const ENTIDAD =
  "INSTITUTO NACIONAL DE INNOVACIÓN AGROPECUARIA Y FORESTAL"

export const CUADRO = {
  5: {
    codigo: "DGCF - R1.05",
    titulo: "RESUMEN DE ALMACENES (BIENES DE CONSUMO)",
    archivo: "cuadro-5-resumen-almacenes",
  },
  6: {
    codigo: "DGCF - R1.06",
    titulo: "DETALLE DE ALMACENES (BIENES DE CONSUMO)",
    archivo: "cuadro-6-detalle-almacenes",
  },
} as const

export const VERSION = "Versión 01"

/** Las dos notas al pie de la planilla del Ministerio, textuales. */
export const NOTAS_MINISTERIO = [
  "Nota: La información expuesta en el presente cuadro cuenta con la documentación de soporte correspondiente, en el marco de las Normas Básicas del Sistema de Contabilidad Integrada.",
  "Nota: Las entidades del sector público, que NO esten comprendidas dentro del Órgano Ejecutivo (Vicepresidencia, Ministerios de Estado y Tesoro General de la Nación), deben dar cumplimiento al Artículo 46 de las NBSCI, respecto a las firmas de los Estados Financieros y estados de cuenta o información complementaria.",
]

/** De qué almacén es el cuadro, o que es el institucional. */
export function alcance(datos: DatosCuadros): string {
  return datos.almacen
    ? `ALMACÉN: ${datos.almacen.nombre}`
    : `CONSOLIDADO INSTITUCIONAL (${datos.cierres.length} ${
        datos.cierres.length === 1 ? "almacén" : "almacenes"
      }; sin los traspasos entre almacenes)`
}

/** Aviso de PROVISIONAL, o null si el cuadro ya es definitivo. */
export function avisoProvisional(datos: DatosCuadros): string | null {
  if (!datos.provisional) return null
  return (
    `PROVISIONAL: todavía no cerraron la gestión ${datos.gestion}: ` +
    `${datos.pendientes.map((a) => a.nombre).join(", ")}.`
  )
}

/** Aviso si algún cierre incluido fue anticipado (saldos antes del 31/12). */
export function avisoAnticipado(datos: DatosCuadros): string | null {
  const anticipados = datos.cierres.filter((c) => c.anticipado)
  if (anticipados.length === 0) return null
  const fecha = (iso: string) =>
    new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  return (
    "Cierre anticipado: los saldos son a la fecha del cierre (" +
    anticipados
      .map((c) => `${c.almacen.nombre}, ${fecha(c.cerradoEn)}`)
      .join("; ") +
    "), no al 31 de diciembre."
  )
}

/** Centavos enteros: sumar importes en coma flotante arrastra error. */
const centavos = (valor: string) => Math.round(Number(valor) * 100)

export interface FilaCuadro5 {
  partidaCodigo: string
  partidaDenominacion: string
  cantInicial: number
  valInicial: number
  cantFinal: number
  valFinal: number
}

/**
 * El Cuadro 5: las filas del 6 sumadas por PARTIDA. Las cantidades suman
 * unidades distintas (paquetes con cajas): es lo que pide la planilla.
 */
export function agruparCuadro5(filas: FilaCuadro[]): FilaCuadro5[] {
  const grupos = new Map<
    string,
    {
      fila: FilaCuadro5
      cInicial: number
      cFinal: number
      qInicial: number
      qFinal: number
    }
  >()
  for (const f of filas) {
    let g = grupos.get(f.partidaCodigo)
    if (!g) {
      g = {
        fila: {
          partidaCodigo: f.partidaCodigo,
          partidaDenominacion: f.partidaDenominacion,
          cantInicial: 0,
          valInicial: 0,
          cantFinal: 0,
          valFinal: 0,
        },
        cInicial: 0,
        cFinal: 0,
        qInicial: 0,
        qFinal: 0,
      }
      grupos.set(f.partidaCodigo, g)
    }
    g.cInicial += centavos(f.valInicial)
    g.cFinal += centavos(f.valFinal)
    g.qInicial += centavos(f.cantInicial)
    g.qFinal += centavos(f.cantFinal)
  }
  return [...grupos.values()].map((g) => ({
    ...g.fila,
    cantInicial: g.qInicial / 100,
    valInicial: g.cInicial / 100,
    cantFinal: g.qFinal / 100,
    valFinal: g.cFinal / 100,
  }))
}

/** Totales de valores del Cuadro 6, sumados en centavos. */
export function totalesCuadro6(filas: FilaCuadro[]) {
  const t = { inicial: 0, entradas: 0, salidas: 0, final: 0 }
  for (const f of filas) {
    t.inicial += centavos(f.valInicial)
    t.entradas += centavos(f.valEntradas)
    t.salidas += centavos(f.valSalidas)
    t.final += centavos(f.valFinal)
  }
  return {
    inicial: t.inicial / 100,
    entradas: t.entradas / 100,
    salidas: t.salidas / 100,
    final: t.final / 100,
  }
}

/** `cuadro-6-detalle-almacenes-2026-oficina-nacional`, sin extensión. */
export function nombreBase(numero: NumeroCuadro, datos: DatosCuadros): string {
  const quien = datos.almacen
    ? datos.almacen.nombre
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    : "institucional"
  return `${CUADRO[numero].archivo}-${datos.gestion}-${quien}${
    datos.provisional ? "-provisional" : ""
  }`
}
