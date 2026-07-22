import { z } from "zod"

/**
 * Espejo de `CreateFuenteFinanciamientoDto`/`UpdateFuenteFinanciamientoDto`.
 * Solo `nombre` es obligatorio; el código puede quedar vacío.
 *
 * La unicidad del nombre no se valida acá: es una restricción de base de datos,
 * así que la resuelve el backend y llega como 409.
 */
export const fuenteFinanciamientoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(150, "El nombre no puede superar los 150 caracteres"),
  codigo: z
    .string()
    .trim()
    .max(50, "El código no puede superar los 50 caracteres"),
  activo: z.boolean(),
})

export type FuenteFinanciamientoFormValues = z.infer<
  typeof fuenteFinanciamientoSchema
>
