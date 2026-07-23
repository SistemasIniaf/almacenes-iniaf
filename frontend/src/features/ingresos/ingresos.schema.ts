import { z } from "zod"

import type {
  CreateIngresoPayload,
  Ingreso,
} from "@/features/ingresos/ingresos.types"

/**
 * Un ingreso se guarda como BORRADOR: la cabecera es toda opcional (se completa
 * al confirmar, lo valida el backend). Lo único que se valida acá son las LÍNEAS:
 * si agregás una, tiene que tener ítem, cantidad > 0 y precio ≥ 0.
 *
 * Los ids (proveedor, fuente, etc.) se manejan como string ("" = sin selección)
 * porque es lo que entregan Select/Combobox; las fechas son `Date` (DatePicker).
 */
const lineaSchema = z.object({
  itemId: z.string().min(1, "Elegí un ítem"),
  cantidad: z
    .string()
    .refine((v) => v.trim() !== "" && Number(v) > 0, "Cantidad mayor a 0"),
  precioUnitario: z
    .string()
    .refine((v) => v.trim() !== "" && Number(v) >= 0, "Precio válido"),
})

export const ingresoSchema = z.object({
  almacenId: z.string(),
  fechaRemision: z.date().optional(),
  notaRemision: z.string().trim().max(100),
  procesoC31: z.string().trim().max(100),
  certificacion: z.string().trim().max(150),
  informeConformidad: z.string().trim().max(200),
  fechaInformeConformidad: z.date().optional(),
  numeroFactura: z.string().trim().max(50),
  observacion: z.string().trim().max(500),
  proveedorId: z.string(),
  fuenteFinanciamientoId: z.string(),
  responsableConformidadId: z.string(),
  unidadSolicitanteId: z.string(),
  detalles: z.array(lineaSchema),
})

export type IngresoFormValues = z.infer<typeof ingresoSchema>

export const VALORES_INICIALES: IngresoFormValues = {
  almacenId: "",
  fechaRemision: undefined,
  notaRemision: "",
  procesoC31: "",
  certificacion: "",
  informeConformidad: "",
  fechaInformeConformidad: undefined,
  numeroFactura: "",
  observacion: "",
  proveedorId: "",
  fuenteFinanciamientoId: "",
  responsableConformidadId: "",
  unidadSolicitanteId: "",
  detalles: [],
}

/** Fecha del DatePicker (local) a ISO de solo día, o null si no hay. */
function aIso(fecha: Date | undefined): string | null {
  if (!fecha) return null
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, "0")
  const d = String(fecha.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const idOnull = (s: string): number | null => (s === "" ? null : Number(s))

/** Convierte el formulario al payload de la API (manda el estado completo). */
export function aPayload(
  v: IngresoFormValues,
  opciones: { incluirAlmacen: boolean }
): CreateIngresoPayload {
  return {
    ...(opciones.incluirAlmacen && v.almacenId
      ? { almacenId: Number(v.almacenId) }
      : {}),
    fechaRemision: aIso(v.fechaRemision),
    notaRemision: v.notaRemision,
    procesoC31: v.procesoC31,
    certificacion: v.certificacion,
    informeConformidad: v.informeConformidad,
    fechaInformeConformidad: aIso(v.fechaInformeConformidad),
    numeroFactura: v.numeroFactura,
    observacion: v.observacion,
    proveedorId: idOnull(v.proveedorId),
    fuenteFinanciamientoId: idOnull(v.fuenteFinanciamientoId),
    responsableConformidadId: idOnull(v.responsableConformidadId),
    unidadSolicitanteId: idOnull(v.unidadSolicitanteId),
    detalles: v.detalles.map((d) => ({
      itemId: Number(d.itemId),
      cantidad: Number(d.cantidad),
      precioUnitario: Number(d.precioUnitario),
    })),
  }
}

/** Carga un ingreso existente en los valores del formulario. */
export function desdeIngreso(ing: Ingreso): IngresoFormValues {
  const fecha = (s: string | null): Date | undefined =>
    s ? new Date(s) : undefined
  const str = (n: number | null): string => (n == null ? "" : String(n))
  return {
    almacenId: String(ing.almacenId),
    fechaRemision: fecha(ing.fechaRemision),
    notaRemision: ing.notaRemision ?? "",
    procesoC31: ing.procesoC31 ?? "",
    certificacion: ing.certificacion ?? "",
    informeConformidad: ing.informeConformidad ?? "",
    fechaInformeConformidad: fecha(ing.fechaInformeConformidad),
    numeroFactura: ing.numeroFactura ?? "",
    observacion: ing.observacion ?? "",
    proveedorId: str(ing.proveedorId),
    fuenteFinanciamientoId: str(ing.fuenteFinanciamientoId),
    responsableConformidadId: str(ing.responsableConformidadId),
    unidadSolicitanteId: str(ing.unidadSolicitanteId),
    detalles: ing.detalles.map((d) => ({
      itemId: String(d.itemId),
      cantidad: d.cantidad,
      precioUnitario: d.precioUnitario,
    })),
  }
}
