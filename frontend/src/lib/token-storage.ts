/**
 * Guarda los tokens fuera de React para que el interceptor de axios pueda
 * leerlos/escribirlos sin depender del ciclo de render.
 *
 * Se usa localStorage (no cookies httpOnly) porque el backend emite JWT por
 * body y el sistema vive detras de login en red interna de la institucion.
 */

const ACCESS_KEY = "almacenes.accessToken"
const REFRESH_KEY = "almacenes.refreshToken"

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens({ accessToken, refreshToken }: Tokens): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
