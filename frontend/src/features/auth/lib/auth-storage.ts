import type { AuthUser } from "@/features/auth/lib/auth.types"

/**
 * Cache del usuario logueado. Existe por una sola razon: `GET /auth/me` devuelve
 * el contenido del token (id, usuario, rol, unidadId, almacenId) pero NO el
 * `nombre`, que solo llega en la respuesta del login. Sin este cache, al recargar
 * la pagina la barra lateral perderia el nombre completo.
 *
 * La fuente de verdad sigue siendo `/auth/me`: al rehidratar se pisan todos los
 * campos con la respuesta del servidor y solo se conserva `nombre` de aqui.
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
