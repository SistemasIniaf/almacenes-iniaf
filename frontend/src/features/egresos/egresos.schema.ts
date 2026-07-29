import { z } from "zod"

import type {
  CreateEgresoPayload,
  Egreso,
  UpdateEgresoPayload,
} from "@/features/egresos/egresos.types"

/**
 * Espejo de `CreateEgresoDto`. La línea apunta al LOTE, no al ítem: el
 * solicitante elige de qué compra y de qué fuente sale el material.
 *
 * `ingresoDetalleId` va como string porque es lo que entrega el combo; se
 * convierte a number al armar el payload.
 */
const lineaSchema = z.object({
  ingresoDetalleId: z.string().min(1, "Elegí de qué lote sale"),
  cantidadSolicitada: z
    .number({ message: "Ingresá la cantidad" })
    .positive("La cantidad debe ser mayor a cero"),
  observacion: z.string().trim().max(200),
})

export const egresoSchema = z.object({
  justificacion: z
    .string()
    .trim()
    .min(1, "Contá para qué se pide el material")
    .max(300, "La justificación no puede superar los 300 caracteres"),
  detalles: z.array(lineaSchema).min(1, "Agregá al menos un ítem"),
})

export type EgresoFormValues = z.infer<typeof egresoSchema>

export const VALORES_INICIALES: EgresoFormValues = {
  justificacion: "",
  detalles: [],
}

/** Línea vacía para el botón «Agregar ítem». */
export const LINEA_VACIA: EgresoFormValues["detalles"][number] = {
  ingresoDetalleId: "",
  cantidadSolicitada: 0,
  observacion: "",
}

export function aPayload(v: EgresoFormValues): CreateEgresoPayload {
  return {
    justificacion: v.justificacion,
    detalles: v.detalles.map((d) => ({
      ingresoDetalleId: Number(d.ingresoDetalleId),
      cantidadSolicitada: d.cantidadSolicitada,
      ...(d.observacion ? { observacion: d.observacion } : {}),
    })),
  }
}

/** En edición el backend REEMPLAZA las líneas con las que le mandes. */
export function aPayloadEdicion(v: EgresoFormValues): UpdateEgresoPayload {
  return aPayload(v)
}

/** Carga un egreso existente en los valores del formulario. */
export function desdeEgreso(egreso: Egreso): EgresoFormValues {
  return {
    justificacion: egreso.justificacion,
    detalles: egreso.detalles.map((d) => ({
      ingresoDetalleId: String(d.ingresoDetalleId),
      cantidadSolicitada: Number(d.cantidadSolicitada),
      observacion: d.observacion ?? "",
    })),
  }
}
