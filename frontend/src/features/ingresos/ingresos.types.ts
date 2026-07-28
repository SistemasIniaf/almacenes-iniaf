import type { PaginationQuery } from "@/lib/types"

export type EstadoIngreso = "CONFIRMADO" | "ANULADO"

interface RefNombre {
  id: number
  nombre: string
}

/** Personas del ingreso: el `cargo` va en los pies de firma del impreso. */
interface RefPersona extends RefNombre {
  cargo: string | null
}

/** Línea de un ingreso (lote). Los decimales llegan como string (Prisma Decimal). */
export interface IngresoDetalle {
  id: number
  itemId: number
  cantidad: string
  precioUnitario: string
  saldoCantidad: string
  observacion: string | null
  item: {
    id: number
    codigo: string
    descripcion: string
    unidadMedida: string
    /** Va como columna propia en la nota impresa. */
    partida: { id: number; codigo: string }
  }
}

/** Forma completa (GET /ingresos/:id). */
export interface Ingreso {
  id: number
  estado: EstadoIngreso
  numero: number | null
  gestion: number | null
  almacenId: number
  fechaRemision: string | null
  notaRemision: string | null
  procesoC31: string | null
  certificacion: string | null
  informeConformidad: string | null
  fechaInformeConformidad: string | null
  numeroFactura: string | null
  observacion: string | null
  proveedorId: number | null
  fuenteFinanciamientoId: number | null
  responsableConformidadId: number | null
  unidadSolicitanteId: number | null
  registradoPorId: number
  anuladoPorId: number | null
  anuladoEn: string | null
  motivoAnulacion: string | null
  createdAt: string
  updatedAt: string
  almacen: RefNombre
  proveedor: (RefNombre & { nit: string | null }) | null
  fuenteFinanciamiento: RefNombre | null
  responsableConformidad: RefPersona | null
  unidadSolicitante: { id: number; nombre: string; sigla: string } | null
  registradoPor: RefPersona
  anuladoPor: RefNombre | null
  detalles: IngresoDetalle[]
}

/** Forma liviana del listado (GET /ingresos). */
export interface IngresoListItem {
  id: number
  estado: EstadoIngreso
  numero: number | null
  gestion: number | null
  almacenId: number
  fechaRemision: string | null
  notaRemision: string | null
  procesoC31: string | null
  numeroFactura: string | null
  /** Es columna del listado: dice de qué fue la compra. */
  observacion: string | null
  createdAt: string
  updatedAt: string
  almacen: RefNombre
  proveedor: RefNombre | null
  fuenteFinanciamiento: RefNombre | null
  _count: { detalles: number }
}

export interface QueryIngresos extends PaginationQuery {
  estado?: EstadoIngreso
  gestion?: number
  almacenId?: number
  proveedorId?: number
  fuenteFinanciamientoId?: number
}

/** Una línea en el payload (número, no string). */
export interface DetallePayload {
  itemId: number
  cantidad: number
  precioUnitario: number
  observacion?: string
}

/**
 * Se manda el estado completo del formulario: los textos como string ("" limpia),
 * los ids como number|null (null limpia) y las fechas como ISO|null. El backend
 * normaliza y exige los respaldos obligatorios al registrar.
 */
export interface CreateIngresoPayload {
  /** Solo lo mandan super_admin/admin. */
  almacenId?: number
  fechaRemision?: string | null
  notaRemision?: string
  procesoC31?: string
  certificacion?: string
  informeConformidad?: string
  fechaInformeConformidad?: string | null
  numeroFactura?: string
  observacion?: string
  proveedorId?: number | null
  fuenteFinanciamientoId?: number | null
  responsableConformidadId?: number | null
  unidadSolicitanteId?: number | null
  detalles?: DetallePayload[]
}

/**
 * Editar solo cambia la cabecera documental. NO lleva `detalles`, `almacenId`,
 * `fuenteFinanciamientoId` ni `fechaRemision`: esos tocan stock / correlativo y
 * para corregirlos se anula el ingreso y se registra de nuevo (espeja el DTO).
 */
export interface UpdateIngresoPayload {
  notaRemision?: string
  procesoC31?: string
  certificacion?: string
  informeConformidad?: string
  fechaInformeConformidad?: string | null
  numeroFactura?: string
  observacion?: string
  proveedorId?: number | null
  responsableConformidadId?: number | null
  unidadSolicitanteId?: number | null
}

/** Etiqueta impresa del número: 001/2026. */
export function etiquetaNumero(ingreso: {
  numero: number | null
  gestion: number | null
}): string {
  if (ingreso.numero == null || ingreso.gestion == null) return "—"
  return `${String(ingreso.numero).padStart(3, "0")}/${ingreso.gestion}`
}

export const ESTADO_LABEL: Record<EstadoIngreso, string> = {
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
}
