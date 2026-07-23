import { api } from "@/lib/api"

import type { PaginatedResult } from "@/lib/types"
import type {
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

/** Solicitador (lista chica para el selector de responsable de conformidad). */
export interface Solicitador {
  id: number
  nombre: string
  usuario: string
}

export async function listarSolicitadores(): Promise<Solicitador[]> {
  const { data } = await api.get<Solicitador[]>("/usuarios/solicitadores")
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
