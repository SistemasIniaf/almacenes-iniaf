import { z } from "zod"

export const loginSchema = z.object({
  usuario: z
    .string()
    .min(1, "El usuario es requerido")
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(50, "El usuario no puede superar los 50 caracteres")
    .regex(/^[a-zA-Z0-9_.]+$/, "Solo letras, números, punto y guión bajo"),

  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(100, "La contraseña no puede superar los 100 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormOutput = z.infer<typeof loginSchema>
