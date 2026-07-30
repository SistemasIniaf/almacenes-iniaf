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
 * TODO va como string, igual que en el ingreso: es lo que entregan el combo
 * (`ingresoDetalleId`) y `NumberField` (`cantidadSolicitada`, que se mantiene
 * como texto a propósito para no lidiar con `NaN` al vaciar el campo). La
 * conversión a number ocurre al armar el payload.
 */
const lineaSchema = z.object({
  ingresoDetalleId: z.string().min(1, "Elegí de qué lote sale"),
  cantidadSolicitada: z
    .string()
    .refine(
      (v) => v.trim() !== "" && Number(v) > 0,
      "La cantidad debe ser mayor a 0"
    ),
})

export const egresoSchema = z
  .object({
    justificacion: z
      .string()
      .trim()
      .min(1, "Contá para qué se pide el material")
      .max(300, "La justificación no puede superar los 300 caracteres"),
    detalles: z.array(lineaSchema).min(1, "Agregá al menos un ítem"),
  })
  /**
   * Un lote no puede aparecer en dos líneas. Si pudiera, cada una mostraría el
   * mismo disponible sin descontar lo que pide la otra y se podría pedir el doble
   * de lo que hay. Es la misma regla que el backend aplica en
   * `validarDisponibilidad`; acá está para avisar en la línea culpable en vez de
   * rebotar el pedido entero al guardar.
   *
   * El selector ya no ofrece lotes tomados por otras líneas, así que esto es la
   * red: cubre un borrador viejo o un lote que quede repetido por otra vía.
   */
  .superRefine((valores, ctx) => {
    const primeraLinea = new Map<string, number>()
    valores.detalles.forEach((detalle, indice) => {
      const lote = detalle.ingresoDetalleId
      if (!lote) return
      if (!primeraLinea.has(lote)) {
        primeraLinea.set(lote, indice)
        return
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        // Al índice de la línea repetida, no al arreglo: así el error lo pinta
        // el propio combo y se ve dónde está el problema.
        path: ["detalles", indice, "ingresoDetalleId"],
        message: "Este lote ya está en otra línea: juntá las cantidades",
      })
    })
  })

export type EgresoFormValues = z.infer<typeof egresoSchema>

export const VALORES_INICIALES: EgresoFormValues = {
  justificacion: "",
  detalles: [],
}

/**
 * Línea vacía para el botón «Agregar ítem». No lleva observación: la línea de
 * egreso no tiene nota propia (decisión del encargado, 2026-07-30) — lo que hay
 * que aclarar del pedido va en la `justificacion` de la cabecera.
 */
export const LINEA_VACIA: EgresoFormValues["detalles"][number] = {
  ingresoDetalleId: "",
  cantidadSolicitada: "",
}

export function aPayload(v: EgresoFormValues): CreateEgresoPayload {
  return {
    justificacion: v.justificacion,
    detalles: v.detalles.map((d) => ({
      ingresoDetalleId: Number(d.ingresoDetalleId),
      cantidadSolicitada: Number(d.cantidadSolicitada),
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
      cantidadSolicitada: String(Number(d.cantidadSolicitada)),
    })),
  }
}
