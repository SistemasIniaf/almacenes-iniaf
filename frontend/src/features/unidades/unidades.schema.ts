import { z } from "zod"

/**
 * Refleja `CreateUnidadDto` / `UpdateUnidadDto` del backend (max 150 y 20).
 * Si cambian los `@MaxLength` alla, actualizar aca.
 */
export const unidadSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(150, "El nombre no puede superar los 150 caracteres"),
  sigla: z
    .string()
    .trim()
    .min(1, "La sigla es requerida")
    .max(20, "La sigla no puede superar los 20 caracteres"),
  activo: z.boolean(),
})

export type UnidadFormValues = z.infer<typeof unidadSchema>
