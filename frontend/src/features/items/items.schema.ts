import { z } from "zod"

/**
 * Espejo de `CreateItemDto` (descripcion max 300, unidadMedida max 50).
 * `partidaId` viaja como string porque es lo que entrega el ComboboxField; se
 * convierte a number al armar el payload.
 *
 * No incluye `codigo`: lo autogenera el backend a partir de la partida.
 */
export const itemSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "La descripción es requerida")
    .max(300, "La descripción no puede superar los 300 caracteres"),
  unidadMedida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es requerida")
    .max(50, "La unidad de medida no puede superar los 50 caracteres"),
  partidaId: z.string().min(1, "La partida es requerida"),
  activo: z.boolean(),
  /**
   * Imagen elegida al CREAR, que se sube recién después del POST (el endpoint
   * de imagen necesita el id). Vive dentro del formulario a propósito: así
   * `reset()` la limpia junto con el resto y no hace falta estado aparte.
   * Es opcional y no se valida acá — el tamaño y el formato los revisa
   * `validarImagen()` en el momento de elegir el archivo.
   */
  archivo: z.union([z.instanceof(File), z.null()]),
})

export type ItemFormValues = z.infer<typeof itemSchema>

/** Sugerencias frecuentes para la unidad de medida (el campo es texto libre). */
export const UNIDADES_MEDIDA_SUGERIDAS = [
  "Unidad",
  "Caja",
  "Paquete",
  "Resma",
  "Litro",
  "Metro",
  "Kilogramo",
  "Pieza",
  "Rollo",
  "Juego",
]
