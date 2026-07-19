import { z } from "zod"

/**
 * Refleja el `LoginDto` del backend, que solo exige usuario y password no vacios.
 * OJO: aqui NO van reglas de composicion de la contrasena (mayuscula, numero,
 * longitud minima). Esas pertenecen al formulario de CREAR/EDITAR usuario; en el
 * login solo bloquearian a usuarios validos con contrasenas antiguas.
 */
export const loginSchema = z.object({
  usuario: z.string().trim().min(1, "El usuario es requerido"),
  password: z.string().min(1, "La contrasena es requerida"),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormOutput = z.infer<typeof loginSchema>
