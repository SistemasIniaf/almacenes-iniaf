import { useCallback, useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { AuthContext } from "@/features/auth/context/auth-context"
import { login as loginRequest, me } from "@/features/auth/api/auth.api"
import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
} from "@/features/auth/lib/auth-storage"
import { setSesionExpiradaHandler } from "@/lib/api"
import {
  MINUTOS_INACTIVIDAD,
  marcarActividad,
  olvidarActividad,
  restanteInactividad,
} from "@/lib/inactividad"
import { clearTokens, getAccessToken, setTokens } from "@/lib/token-storage"

import type { AuthContextValue } from "@/features/auth/context/auth-context"
import type { AuthUser, LoginRequest } from "@/features/auth/lib/auth.types"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [cargando, setCargando] = useState(true)

  /** Corta la sesion en todos lados: tokens, cache local, estado y cache de queries. */
  const limpiarSesion = useCallback(() => {
    clearTokens()
    clearStoredUser()
    olvidarActividad()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  // Rehidrata la sesion al montar: si hay access token, se valida contra el backend.
  useEffect(() => {
    let cancelado = false

    async function rehidratar() {
      if (!getAccessToken()) {
        setCargando(false)
        return
      }

      // La pestaña quedó abierta (o se restauró) después del límite de
      // inactividad: se cierra sin llegar a mostrar el sistema.
      if (restanteInactividad() <= 0) {
        limpiarSesion()
        setCargando(false)
        toast.info(
          `Se cerró la sesión tras ${MINUTOS_INACTIVIDAD} minutos sin actividad.`
        )
        return
      }

      // Pintado optimista con el cache mientras responde /auth/me.
      const cache = getStoredUser()
      if (cache && !cancelado) setUser(cache)

      try {
        // `/auth/me` ya trae el perfil completo (nombre, cargo, unidad y
        // almacén): se pisa entero, sin conservar nada del cache.
        const perfil = await me()
        if (cancelado) return
        setUser(perfil)
        setStoredUser(perfil)
      } catch {
        // 401 con refresh fallido: el interceptor ya limpio los tokens.
        if (!cancelado) limpiarSesion()
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    void rehidratar()
    return () => {
      cancelado = true
    }
  }, [limpiarSesion])

  // El interceptor avisa cuando el refresh murio: hay que tumbar el estado de React.
  useEffect(() => {
    setSesionExpiradaHandler(limpiarSesion)
    return () => setSesionExpiradaHandler(null)
  }, [limpiarSesion])

  const login = useCallback(
    async (credenciales: LoginRequest): Promise<AuthUser> => {
      const {
        accessToken,
        refreshToken,
        user: usuario,
      } = await loginRequest(credenciales)
      setTokens({ accessToken, refreshToken })
      // Acá y no en `setTokens`: el refresh automático también los guarda, y un
      // refetch en segundo plano no es actividad del usuario.
      marcarActividad()
      setStoredUser(usuario)
      setUser(usuario)
      return usuario
    },
    []
  )

  const logout = limpiarSesion

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      cargando,
      autenticado: user !== null,
      login,
      logout,
    }),
    [user, cargando, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
