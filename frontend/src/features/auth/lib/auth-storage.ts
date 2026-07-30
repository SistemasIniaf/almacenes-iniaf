import type { AuthUser } from "@/features/auth/lib/auth.types"

/**
 * Cache del usuario logueado. Ya NO es indispensable —desde 2026-07-30
 * `GET /auth/me` devuelve el perfil completo, nombre incluido— y quedó solo para
 * pintar la barra lateral al instante mientras esa llamada viaja, en vez de
 * mostrar un hueco en cada recarga.
 *
 * La fuente de verdad es `/auth/me`: al rehidratar se pisa el objeto ENTERO con
 * la respuesta del servidor, sin conservar ningún campo de aquí.
 */
const USER_KEY = "almacenes.user"

export function getStoredUser(): AuthUser | null {
  const crudo = localStorage.getItem(USER_KEY)
  if (!crudo) return null
  try {
    return JSON.parse(crudo) as AuthUser
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY)
}
