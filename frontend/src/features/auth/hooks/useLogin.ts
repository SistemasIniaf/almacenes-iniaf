import { useMutation } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { getApiErrorMessage } from "@/lib/api"

import type { LoginRequest } from "@/features/auth/lib/auth.types"

/**
 * Envuelve el login del AuthProvider en una mutacion para tener estado de
 * carga/error listo para la UI.
 */
export function useLogin() {
  const { login } = useAuth()

  const mutation = useMutation({
    mutationFn: (credenciales: LoginRequest) => login(credenciales),
  })

  return {
    ...mutation,
    mensajeError: mutation.error
      ? getApiErrorMessage(mutation.error, "No se pudo iniciar sesion.")
      : null,
  }
}
