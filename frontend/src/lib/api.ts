import axios, { AxiosError, AxiosHeaders } from "axios"

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/token-storage"

import type { InternalAxiosRequestConfig } from "axios"

/** Rutas que NO deben intentar refresh (son las que emiten los tokens). */
const RUTAS_SIN_REFRESH = ["/auth/login", "/auth/refresh"]

/** Marca para no reintentar dos veces la misma peticion. */
interface ConfigConReintento extends InternalAxiosRequestConfig {
  _reintentado?: boolean
}

/**
 * OJO: a proposito NO se fija un `Content-Type` por defecto. Axios lo infiere
 * del cuerpo: `application/json` para objetos y `multipart/form-data` con su
 * boundary para FormData (subida de imagenes). Si se dejara el default JSON,
 * axios convertiria el FormData a JSON (`formDataToJSON`) y la subida se
 * romperia en silencio.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

/**
 * Callback que dispara el AuthProvider cuando el refresh falla definitivamente
 * (sesion muerta): limpia el estado de React y manda al login.
 */
let onSesionExpirada: (() => void) | null = null

export function setSesionExpiradaHandler(handler: (() => void) | null): void {
  onSesionExpirada = handler
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    // AxiosHeaders: mutar `config.headers` directo rompe el tipado en v1.
    const headers = AxiosHeaders.from(config.headers)
    headers.set("Authorization", `Bearer ${token}`)
    config.headers = headers
  }
  return config
})

/**
 * Refresh en vuelo compartido: si varias peticiones reciben 401 a la vez, todas
 * esperan la MISMA llamada a /auth/refresh en lugar de dispararla N veces (lo
 * que invalidaria tokens entre si).
 */
let refreshEnCurso: Promise<string> | null = null

async function refrescarTokens(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error("No hay refresh token")

  // Instancia limpia: no debe pasar por estos interceptores.
  const { data } = await axios.post<{
    accessToken: string
    refreshToken: string
  }>(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refreshToken })

  setTokens(data)
  return data.accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as ConfigConReintento | undefined

    const esRefrescable =
      error.response?.status === 401 &&
      config &&
      !config._reintentado &&
      !RUTAS_SIN_REFRESH.some((ruta) => config.url?.includes(ruta))

    if (!esRefrescable) return Promise.reject(error)

    config._reintentado = true

    try {
      refreshEnCurso ??= refrescarTokens().finally(() => {
        refreshEnCurso = null
      })
      const nuevoToken = await refreshEnCurso

      const headers = AxiosHeaders.from(config.headers)
      headers.set("Authorization", `Bearer ${nuevoToken}`)
      config.headers = headers

      return api(config)
    } catch {
      clearTokens()
      onSesionExpirada?.()
      return Promise.reject(error)
    }
  }
)

/** Forma del error que devuelve NestJS (`message` puede ser array de class-validator). */
interface ApiErrorBody {
  message?: string | string[]
  error?: string
  statusCode?: number
}

/** Extrae un mensaje legible de cualquier error para mostrarlo en la UI. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Ocurrio un error inesperado. Intenta nuevamente."
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return "No se pudo conectar con el servidor. Verifica tu conexion."
    }
    const { message } = error.response.data ?? {}
    if (Array.isArray(message)) return message.join(". ")
    if (message) return message
  }
  return fallback
}
