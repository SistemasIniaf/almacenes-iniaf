import { z } from "zod"

/**
 * Refleja `CambiarClaveDto`: la nueva con la misma regla que al crear el
 * usuario (mínimo 6); la actual solo no vacía, como en el login. La
 * confirmación es solo del formulario y no viaja.
 */
export const cambiarClaveSchema = z
  .object({
    actual: z.string().min(1, "Ingresá tu contraseña actual"),
    nueva: z
      .string()
      .min(6, "La contraseña nueva debe tener al menos 6 caracteres"),
    confirmacion: z.string().min(1, "Repetí la contraseña nueva"),
  })
  .refine((v) => v.nueva === v.confirmacion, {
    path: ["confirmacion"],
    message: "No coincide con la contraseña nueva",
  })
  .refine((v) => v.nueva !== v.actual, {
    path: ["nueva"],
    message: "Tiene que ser distinta de la actual",
  })

export type CambiarClaveValues = z.infer<typeof cambiarClaveSchema>
