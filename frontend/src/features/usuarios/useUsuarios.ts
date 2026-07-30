import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarUsuario,
  crearUsuario,
  desactivarUsuario,
  listarUsuarios,
  obtenerMiAprobador,
} from "@/features/usuarios/usuarios.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateUsuarioPayload,
  QueryUsuarios,
  UpdateUsuarioPayload,
} from "@/features/usuarios/usuarios.types"

export const usuariosKeys = {
  all: ["usuarios"] as const,
  lista: (query: QueryUsuarios) => ["usuarios", "lista", query] as const,
}

export function useUsuarios(query: QueryUsuarios) {
  return useQuery({
    queryKey: usuariosKeys.lista(query),
    queryFn: () => listarUsuarios(query),
    placeholderData: keepPreviousData,
  })
}

/**
 * Quién aprueba mis pedidos. Lo pide el diálogo que confirma el envío, para
 * nombrar a la persona que va a recibir la solicitud. `enabled` para no pedirlo
 * antes de abrir el diálogo: el resto de la pantalla no lo necesita.
 */
export function useMiAprobador(habilitado = true) {
  return useQuery({
    queryKey: ["usuarios", "mi-aprobador"],
    queryFn: obtenerMiAprobador,
    enabled: habilitado,
  })
}

function useInvalidarUsuarios() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: usuariosKeys.all })
}

export function useCrearUsuario() {
  const invalidar = useInvalidarUsuarios()

  return useMutation({
    mutationFn: (payload: CreateUsuarioPayload) => crearUsuario(payload),
    onSuccess: (usuario) => {
      invalidar()
      toast.success(`Usuario "${usuario.usuario}" creado`)
    },
    // Los errores utiles vienen del backend (username en uso, ya hay un
    // aprobador en esa unidad, la unidad esta inactiva...): se muestran tal cual.
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarUsuario() {
  const invalidar = useInvalidarUsuarios()

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateUsuarioPayload & { id: number }) =>
      actualizarUsuario(id, payload),
    onSuccess: (usuario) => {
      invalidar()
      toast.success(`Usuario "${usuario.usuario}" actualizado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDesactivarUsuario() {
  const invalidar = useInvalidarUsuarios()

  return useMutation({
    mutationFn: (id: number) => desactivarUsuario(id),
    onSuccess: (usuario) => {
      invalidar()
      toast.success(`Usuario "${usuario.usuario}" desactivado`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
