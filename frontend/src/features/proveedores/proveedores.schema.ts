import { z } from "zod"

/**
 * Espejo de `CreateProveedorDto`/`UpdateProveedorDto`. Solo `nombre` es
 * obligatorio; el resto puede quedar vacío.
 *
 * La unicidad del NIT no se valida acá: es una restricción de base de datos, así
 * que la resuelve el backend y llega como 409.
 */
export const proveedorSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(200, "El nombre no puede superar los 200 caracteres"),
  nit: z.string().trim().max(20, "El NIT no puede superar los 20 caracteres"),
  telefono: z
    .string()
    .trim()
    .max(50, "El teléfono no puede superar los 50 caracteres"),
  contacto: z
    .string()
    .trim()
    .max(150, "El contacto no puede superar los 150 caracteres"),
  direccion: z
    .string()
    .trim()
    .max(250, "La dirección no puede superar los 250 caracteres"),
  activo: z.boolean(),
})

export type ProveedorFormValues = z.infer<typeof proveedorSchema>
