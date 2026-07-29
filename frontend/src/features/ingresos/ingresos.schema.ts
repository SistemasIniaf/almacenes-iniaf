import { z } from "zod"

import type {
  CreateIngresoPayload,
  Ingreso,
  UpdateIngresoPayload,
} from "@/features/ingresos/ingresos.types"

/**
 * El ingreso se registra definitivo (ya no hay borrador). La cabecera va sin
 * `.min()` porque la validación "dura" de respaldos la hace el backend, que lista
 * lo que falta como toast (un solo lugar, no duplicado acá). Lo que sí se valida
 * en el front son las LÍNEAS: si agregás una, tiene ítem, cantidad > 0 y precio ≥ 0.
 *
 * Los ids (proveedor, fuente, etc.) se manejan como string ("" = sin selección)
 * porque es lo que entregan Select/Combobox; las fechas son `Date` (DatePicker).
 */
const lineaSchema = z.object({
  itemId: z.string().min(1, "Elegí un ítem"),
  cantidad: z
    .string()
    .refine(
      (v) => v.trim() !== "" && Number(v) > 0,
      "La cantidad debe ser mayor a 0"
    ),
  precioUnitario: z
    .string()
    .refine(
      (v) => v.trim() !== "" && Number(v) >= 0,
      "Ingresá un precio válido (0 o más)"
    ),
  // Nota libre opcional (ej. "COLOR NEGRO"); en el reporte va junto al ítem.
  observacion: z.string().trim().max(200, "Máximo 200 caracteres"),
})

export const ingresoSchema = z
  .object({
    // El almacén siempre está resuelto (el responsable usa el suyo, el admin lo
    // elige); igual se exige para que el admin no lo deje vacío.
    almacenId: z.string().min(1, "Elegí el almacén"),
    // Las fechas se validan abajo con superRefine (el DatePicker arranca en
    // `undefined` y `z.date()` sin optional rompería el tipo del valor inicial).
    //
    // `fechaIngreso` NO se pide al crear: la estampa el backend con el momento
    // del registro. Está acá porque el super_admin puede corregirla al editar;
    // para todos los demás el campo es de solo lectura y no viaja en el PATCH.
    fechaIngreso: z.date().optional(),
    fechaRemision: z.date().optional(),
    notaRemision: z.string().trim().min(1, "Ingresá la nota de remisión").max(100),
    procesoC31: z.string().trim().min(1, "Ingresá el proceso Nº / C31").max(100),
    certificacion: z
      .string()
      .trim()
      .min(1, "Ingresá la certificación")
      .max(150),
    informeConformidad: z
      .string()
      .trim()
      .min(1, "Ingresá el informe/acta de conformidad")
      .max(200),
    fechaInformeConformidad: z.date().optional(),
    // Opcionales, igual que en el backend: hay material que entra sin factura
    // (donaciones, transferencias) — ver docs/decisiones-ingresos.md, punto 4.
    numeroFactura: z.string().trim().max(50),
    observacion: z.string().trim().max(500),
    proveedorId: z.string().min(1, "Elegí un proveedor"),
    fuenteFinanciamientoId: z.string().min(1, "Elegí una fuente de financiamiento"),
    responsableConformidadId: z
      .string()
      .min(1, "Elegí el responsable / comisión de recepción"),
    unidadSolicitanteId: z.string().min(1, "Elegí la unidad solicitante"),
    detalles: z.array(lineaSchema).min(1, "Agregá al menos un ítem"),
  })
  .superRefine((v, ctx) => {
    if (!v.fechaRemision) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaRemision"],
        message: "Elegí la fecha de remisión",
      })
    }
    if (!v.fechaInformeConformidad) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaInformeConformidad"],
        message: "Elegí la fecha del informe/acta",
      })
    }
  })

export type IngresoFormValues = z.infer<typeof ingresoSchema>

export const VALORES_INICIALES: IngresoFormValues = {
  almacenId: "",
  fechaIngreso: undefined,
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
      observacion: d.observacion,
    })),
  }
}

/**
 * Payload de EDICIÓN: la cabecera documental. No manda líneas, almacén, fuente
 * ni fecha de remisión — esos no se editan (se anula y se re-registra).
 *
 * `fechaIngreso` solo viaja si `incluirFecha` (super_admin): el backend responde
 * 403 si la manda cualquier otro rol, así que mandarla siempre rompería la
 * edición normal del responsable de almacén.
 */
export function aPayloadEdicion(
  v: IngresoFormValues,
  opciones?: { incluirFecha?: boolean }
): UpdateIngresoPayload {
  return {
    ...(opciones?.incluirFecha && v.fechaIngreso
      ? { fechaIngreso: aIso(v.fechaIngreso) as string }
      : {}),
    notaRemision: v.notaRemision,
    procesoC31: v.procesoC31,
    certificacion: v.certificacion,
    informeConformidad: v.informeConformidad,
    fechaInformeConformidad: aIso(v.fechaInformeConformidad),
    numeroFactura: v.numeroFactura,
    observacion: v.observacion,
    proveedorId: idOnull(v.proveedorId),
    responsableConformidadId: idOnull(v.responsableConformidadId),
    unidadSolicitanteId: idOnull(v.unidadSolicitanteId),
  }
}

/** Carga un ingreso existente en los valores del formulario. */
export function desdeIngreso(ing: Ingreso): IngresoFormValues {
  const fecha = (s: string | null): Date | undefined =>
    s ? new Date(s) : undefined
  const str = (n: number | null): string => (n == null ? "" : String(n))
  return {
    almacenId: String(ing.almacenId),
    fechaIngreso: fecha(ing.fechaIngreso),
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
      observacion: d.observacion ?? "",
    })),
  }
}
