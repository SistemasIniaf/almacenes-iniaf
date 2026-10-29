import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
  ClaveInicial,
  CreateUsuarioPayload,
  QueryUsuarios,
  UpdateUsuarioPayload,
  Usuario,
} from "@/features/usuarios/usuarios.types"

export async function listarUsuarios(
  query: QueryUsuarios
): Promise<PaginatedResult<Usuario>> {
  const { data } = await api.get<PaginatedResult<Usuario>>("/usuarios", {
    params: query,
  })
  return data
}

export async function obtenerUsuario(id: number): Promise<Usuario> {
  const { data } = await api.get<Usuario>(`/usuarios/${id}`)
  return data
}

/** Solicitador (lista chica para el selector de responsable / comision de recepcion). */
export interface Solicitador {
  id: number
  nombre: string
  usuario: string
}

export async function listarSolicitadores(): Promise<Solicitador[]> {
  const { data } = await api.get<Solicitador[]>("/usuarios/solicitadores")
  return data
}

/** Quien aprueba MIS pedidos: el aprobador activo de mi unidad. */
export interface MiAprobador {
  id: number
  nombre: string
  cargo: string | null
}

/** `null` si la unidad no tiene un aprobador activo designado. */
export async function obtenerMiAprobador(): Promise<MiAprobador | null> {
  const { data } = await api.get<MiAprobador | null>("/usuarios/mi-aprobador")
  return data
}

export async function crearUsuario(
  payload: CreateUsuarioPayload
): Promise<Usuario> {
  const { data } = await api.post<Usuario>("/usuarios", payload)
  return data
}

export async function actualizarUsuario(
  id: number,
  payload: UpdateUsuarioPayload
): Promise<Usuario> {
  const { data } = await api.patch<Usuario>(`/usuarios/${id}`, payload)
  return data
}

/** Baja logica: desactiva al usuario y libera su cupo de rol unico. */
export async function desactivarUsuario(id: number): Promise<Usuario> {
  const { data } = await api.delete<Usuario>(`/usuarios/${id}`)
  return data
}

/** Contraseña inicial de las cuentas nuevas (la leen super_admin y admin). */
export async function obtenerClaveInicial(): Promise<ClaveInicial> {
  const { data } = await api.get<ClaveInicial>("/usuarios/clave-inicial")
  return data
}

/** Solo super_admin. Rige para las cuentas que se creen o restablezcan después. */
export async function actualizarClaveInicial(
  claveInicial: string
): Promise<ClaveInicial> {
  const { data } = await api.put<ClaveInicial>("/usuarios/clave-inicial", {
    claveInicial,
  })
  return data
}

/**
 * Usuario + contraseña inicial para copiar. `claveInicial` es `null` si la
 * cuenta ya no tiene la inicial vigente (la cambió): el backend lo compara
 * contra el hash.
 */
export async function obtenerCredenciales(
  id: number
): Promise<{ usuario: string; claveInicial: string | null }> {
  const { data } = await api.get<{
    usuario: string
    claveInicial: string | null
  }>(`/usuarios/${id}/credenciales`)
  return data
}

/** Vuelve la contraseña del usuario a la inicial, obligado a cambiarla. */
export async function restablecerClaveUsuario(id: number): Promise<Usuario> {
  const { data } = await api.post<Usuario>(`/usuarios/${id}/restablecer-clave`)
  return data
}

/** Reactiva (inverso de la baja logica). */
export async function activarUsuario(id: number): Promise<Usuario> {
  const { data } = await api.post<Usuario>(`/usuarios/${id}/activar`)
  return data
}
