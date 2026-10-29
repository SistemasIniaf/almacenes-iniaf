import { documentoDeLote, numeroDocumento } from "@/lib/formato"

import type { PaginationQuery } from "@/lib/types"

interface Ref {
  id: number
  nombre: string
}

/** Número impreso del traspaso: `001-2026` (serie propia del almacén de origen). */
export const etiquetaNumero = (t: { numero: number; gestion: number }) =>
  numeroDocumento(t)

/**
 * Un lote, tal como lo devuelve `GET /traspasos/lotes` y la ficha del traspaso.
 * Su «documento» es el ingreso que lo trajo o, si ya había llegado por otro
 * traspaso, ese traspaso (el ingreso portador no tiene número).
 */
export interface LoteTraspaso {
  id: number
  cantidad: string
  precioUnitario: string
  saldoCantidad: string
  observacion: string | null
  item: {
    id: number
    codigo: string
    descripcion: string
    unidadMedida: string
    partida: { id: number; codigo: string }
  }
  ingreso: {
    id: number
    numero: number | null
    gestion: number | null
    fechaIngreso: string
    fuenteFinanciamiento: Ref | null
    proveedor: Ref | null
    traspaso: { id: number; numero: number; gestion: number } | null
  }
}

/** Con lo reservado por pedidos en curso: solo `disponible` se puede traspasar. */
export interface LoteDisponible extends LoteTraspaso {
  reservado: number
  disponible: number
}

export interface TraspasoListItem {
  id: number
  numero: number
  gestion: number
  fecha: string
  observacion: string
  almacenOrigen: Ref
  almacenDestino: Ref
  registradoPor: Ref
  lineas: number
  total: number
}

export interface Traspaso {
  id: number
  numero: number
  gestion: number
  fecha: string
  observacion: string
  createdAt: string
  almacenOrigen: Ref
  almacenDestino: Ref
  registradoPor: Ref & { cargo: string | null }
  detalles: {
    id: number
    cantidad: string
    loteOrigen: LoteTraspaso
    loteDestinoId: number
  }[]
}

export interface QueryTraspasos extends PaginationQuery {
  almacenId?: number
  gestion?: number
}

export interface CreateTraspasoPayload {
  almacenOrigenId: number
  almacenDestinoId: number
  observacion: string
  detalles: { ingresoDetalleId: number; cantidad: number }[]
}

/** De qué documento viene un lote: `ingreso 001-2026` o `traspaso 002-2026`. */
export const documentoLote = (ingreso: LoteTraspaso["ingreso"]): string =>
  documentoDeLote(ingreso)

/** «BOLÍGRAFO (COLOR AZUL)», como en la nota de ingreso. */
export const descripcionLote = (lote: LoteTraspaso) =>
  lote.observacion
    ? `${lote.item.descripcion} (${lote.observacion})`
    : lote.item.descripcion
