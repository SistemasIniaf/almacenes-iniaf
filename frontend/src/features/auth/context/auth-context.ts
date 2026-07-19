import { createContext } from "react"

import type { AuthUser, LoginRequest } from "@/features/auth/lib/auth.types"

export interface AuthContextValue {
  user: AuthUser | null
  /** true mientras se rehidrata la sesion al montar (evita parpadeo al login). */
  cargando: boolean
  autenticado: boolean
  login: (credenciales: LoginRequest) => Promise<AuthUser>
  logout: () => void
}

/**
 * En archivo .ts aparte del provider: la regla `react-refresh/only-export-components`
 * prohibe exportar no-componentes desde un .tsx de componentes.
 */
export const AuthContext = createContext<AuthContextValue | null>(null)
