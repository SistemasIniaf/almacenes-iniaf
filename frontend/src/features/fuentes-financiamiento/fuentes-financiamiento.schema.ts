import { z } from "zod"

/**
 * Espejo de `CreateFuenteFinanciamientoDto`/`UpdateFuenteFinanciamientoDto`.
 * El formulario ya no lleva código (2026-11-04): la fuente es solo su nombre.
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
  activo: z.boolean(),
})

export type FuenteFinanciamientoFormValues = z.infer<
  typeof fuenteFinanciamientoSchema
>
