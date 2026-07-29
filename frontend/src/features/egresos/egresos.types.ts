import type { PaginationQuery } from "@/lib/types"

export type EstadoEgreso =
  | "BORRADOR"
  | "PENDIENTE_APROBADOR"
  | "PENDIENTE_RESPONSABLE_ALMACEN"
  | "ENTREGADO"
  | "ANULADO"

/** Etiquetas del circuito, como las lee quien las mira en pantalla. */
export const ESTADO_LABEL: Record<EstadoEgreso, string> = {
  BORRADOR: "Borrador",
  PENDIENTE_APROBADOR: "Esperando al jefe de unidad",
  PENDIENTE_RESPONSABLE_ALMACEN: "Esperando entrega",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
}

export const ESTADO_VARIANT: Record<
  EstadoEgreso,
  "default" | "secondary" | "outline" | "destructive"
> = {
  BORRADOR: "outline",
  PENDIENTE_APROBADOR: "secondary",
  PENDIENTE_RESPONSABLE_ALMACEN: "secondary",
  ENTREGADO: "default",
  ANULADO: "destructive",
}

interface RefNombre {
  id: number
  nombre: string
}

interface RefPersona extends RefNombre {
  cargo: string | null
}

/** El lote del que sale el material: de él derivan ítem, fuente y precio. */
export interface LoteDeLinea {
  id: number
  precioUnitario: string
  saldoCantidad: string
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
    fuenteFinanciamiento: RefNombre | null
  }
}

export interface EgresoDetalle {
  id: number
  ingresoDetalleId: number
  cantidadSolicitada: string
  /** Null hasta la entrega. La ajusta solo el responsable de almacén. */
  cantidadEntregada: string | null
  observacion: string | null
  ingresoDetalle: LoteDeLinea
}

export interface EgresoHistorial {
  id: number
  estadoAnterior: EstadoEgreso | null
  estadoNuevo: EstadoEgreso
  motivo: string | null
  createdAt: string
  usuario: RefNombre
}

/** Forma completa (GET /egresos/:id). */
export interface Egreso {
  id: number
  estado: EstadoEgreso
  /** Nulos mientras es borrador: el número se estampa al enviar. */
  numero: number | null
  gestion: number | null
  almacenId: number
  unidadId: number
  justificacion: string
  fechaEnvio: string | null
  fechaEntrega: string | null
  createdAt: string
  updatedAt: string
  almacen: RefNombre
  unidad: { id: number; nombre: string; sigla: string }
  solicitante: RefPersona & { usuario: string }
  entregadoPorId: number | null
  entregadoPor: RefPersona | null
  anuladoPorId: number | null
  anuladoPor: RefNombre | null
  anuladoEn: string | null
  motivoAnulacion: string | null
  detalles: EgresoDetalle[]
  historial: EgresoHistorial[]
  _count: { detalles: number }
}

/** Forma liviana del listado (GET /egresos). */
export interface EgresoListItem {
  id: number
  estado: EstadoEgreso
  numero: number | null
  gestion: number | null
  almacenId: number
  unidadId: number
  justificacion: string
  fechaEnvio: string | null
  fechaEntrega: string | null
  createdAt: string
  almacen: RefNombre
  unidad: { id: number; nombre: string; sigla: string }
  solicitante: RefNombre
  _count: { detalles: number }
}

export interface QueryEgresos extends PaginationQuery {
  estado?: EstadoEgreso
  gestion?: number
  almacenId?: number
  unidadId?: number
  /** `true` = solo los que esperan una decisión mía (la bandeja del rol). */
  pendientesMios?: boolean
}

export interface LineaPayload {
  ingresoDetalleId: number
  cantidadSolicitada: number
  observacion?: string
}

export interface CreateEgresoPayload {
  justificacion: string
  detalles: LineaPayload[]
}

/** Al editar el borrador, `detalles` REEMPLAZA la lista completa. */
export interface UpdateEgresoPayload {
  justificacion?: string
  detalles?: LineaPayload[]
}

export interface EntregaPayload {
  lineas: { detalleId: number; cantidadEntregada: number }[]
}

/**
 * Etiqueta impresa del número: `001/2026`. Un borrador todavía no tiene número
 * — se estampa al enviar, para que uno descartado no deje un hueco en la serie.
 */
export function etiquetaNumero(egreso: {
  numero: number | null
  gestion: number | null
}): string {
  if (egreso.numero == null || egreso.gestion == null) return "—"
  return `${String(egreso.numero).padStart(3, "0")}/${egreso.gestion}`
}
