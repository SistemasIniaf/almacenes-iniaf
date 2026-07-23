import type { PaginationQuery } from "@/lib/types"

export type EstadoIngreso = "BORRADOR" | "CONFIRMADO" | "ANULADO"

interface RefNombre {
  id: number
  nombre: string
}

/** Línea de un ingreso (lote). Los decimales llegan como string (Prisma Decimal). */
export interface IngresoDetalle {
  id: number
  itemId: number
  cantidad: string
  precioUnitario: string
  saldoCantidad: string
  item: {
    id: number
    codigo: string
    descripcion: string
    unidadMedida: string
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
  proveedor: RefNombre | null
  fuenteFinanciamiento: RefNombre | null
  responsableConformidad: RefNombre | null
  unidadSolicitante: { id: number; nombre: string; sigla: string } | null
  registradoPor: RefNombre
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
}

/**
 * Se manda el estado completo del formulario: los textos como string ("" limpia),
 * los ids como number|null (null limpia) y las fechas como ISO|null. El backend
 * normaliza. Así editar un borrador puede limpiar campos, no solo setearlos.
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

export type UpdateIngresoPayload = Omit<CreateIngresoPayload, "almacenId">

/** Etiqueta impresa del número: 001/2026. */
export function etiquetaNumero(ingreso: {
  numero: number | null
  gestion: number | null
}): string {
  if (ingreso.numero == null || ingreso.gestion == null) return "—"
  return `${String(ingreso.numero).padStart(3, "0")}/${ingreso.gestion}`
}

export const ESTADO_LABEL: Record<EstadoIngreso, string> = {
  BORRADOR: "Borrador",
  CONFIRMADO: "Confirmado",
  ANULADO: "Anulado",
}
