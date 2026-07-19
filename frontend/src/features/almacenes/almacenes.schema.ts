import { z } from "zod"

/**
 * Refleja `CreateAlmacenDto` / `UpdateAlmacenDto` del backend (nombre max 150).
 * La unicidad del nombre NO se valida aca: es una restriccion de base de datos
 * (`@unique`), asi que la resuelve el backend y llega como error 409.
 */
export const almacenSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(150, "El nombre no puede superar los 150 caracteres"),
  activo: z.boolean(),
})

export type AlmacenFormValues = z.infer<typeof almacenSchema>
