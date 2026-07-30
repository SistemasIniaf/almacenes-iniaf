import type { PaginationQuery } from "@/lib/types"

export type EstadoEgreso =
  | "BORRADOR"
  | "PENDIENTE_APROBADOR"
  | "PENDIENTE_RESPONSABLE_ALMACEN"
  | "ENTREGADO"
  | "ANULADO"

/**
 * Etiqueta CORTA, para los badges de las tablas y la ficha. Dice qué falta, en
 * dos palabras: en una celda de tabla, «Esperando al aprobador de unidad»
 * empujaba el ancho de toda la columna.
 */
export const ESTADO_LABEL: Record<EstadoEgreso, string> = {
  // Los tres estados en curso forman UNA serie —PENDIENTE DE ENVÍO → DE
  // APROBACIÓN → DE ENTREGA→ ENTREGADO—: cada uno nombra el paso que falta, en el
  // registro formal que usa la institución. Si cambiás uno, cambiá los tres: que
  // dos sigan un patrón y el tercero otro es lo que hace que un estado se lea
  // como de otro sistema.
  //
  // «Borrador» quedó fuera de la pantalla (2026-07-30): hablaba del documento y
  // no del paso pendiente, y sonaba a algo sin terminar. En la BD el enum SIGUE
  // llamándose BORRADOR — es interno y renombrarlo costaría una migración sin
  // ninguna ganancia.
  BORRADOR: "Pendiente de envío",
  PENDIENTE_APROBADOR: "Pendiente de aprobación",
  PENDIENTE_RESPONSABLE_ALMACEN: "Pendiente de entrega",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
}

/**
 * Etiqueta LARGA, donde hay lugar y conviene ser explícito: el selector de
 * filtros y el campo «Estado» del PDF. Nombra a QUIÉN espera el pedido, que es
 * lo único que la etiqueta corta no dice.
 *
 * «Aprobador de unidad» y no «jefe de unidad»: es como se llama el rol en el
 * sistema (enum `Rol.aprobador`). El único lugar donde sobrevive «Jefe» es el
 * pie de firmas del PDF, que replica el documento oficial.
 */
export const ESTADO_DETALLE: Record<EstadoEgreso, string> = {
  BORRADOR: "Pendiente de envío",
  PENDIENTE_APROBADOR: "Esperando al aprobador de unidad",
  PENDIENTE_RESPONSABLE_ALMACEN: "Esperando entrega en almacén",
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

/**
 * Qué HIZO la persona en cada paso del historial, en pasado. Se deriva de la
 * transición (de qué estado a cuál), no del estado nuevo a secas: mostrar
 * «Esperando entrega · PEDRO FERRANO» describe dónde quedó el pedido, pero deja
 * afuera lo único que importa del renglón, que Pedro lo APROBÓ.
 *
 * El segundo texto dice a quién le queda la pelota, que es lo que la gente
 * quiere saber al mirar un pedido en curso.
 */
export function describirPaso(paso: {
  estadoAnterior: EstadoEgreso | null
  estadoNuevo: EstadoEgreso
}): { accion: string; consecuencia?: string } {
  const { estadoAnterior: de, estadoNuevo: a } = paso

  if (de === null) return { accion: "Creó el pedido" }

  if (a === "ANULADO") {
    return de === "ENTREGADO"
      ? {
          accion: "Anuló la entrega",
          consecuencia: "el material volvió a sus lotes",
        }
      : { accion: "Anuló el pedido" }
  }

  if (a === "BORRADOR") {
    return {
      accion: "Rechazó el pedido",
      consecuencia: "vuelve al solicitante para corregirlo",
    }
  }

  if (a === "PENDIENTE_APROBADOR") {
    return {
      accion: "Envió el pedido",
      consecuencia: "pasa al aprobador de unidad",
    }
  }

  if (a === "PENDIENTE_RESPONSABLE_ALMACEN") {
    return { accion: "Aprobó el pedido", consecuencia: "pasa al almacén" }
  }

  return { accion: "Entregó el material", consecuencia: "se descontó del stock" }
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
    /** Ruta relativa de la foto de catálogo (`/uploads/items/…`) o null. */
    imagenUrl: string | null
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
