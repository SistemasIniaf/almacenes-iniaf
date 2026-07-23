import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarFuente,
  crearFuente,
  desactivarFuente,
  listarFuentes,
} from "@/features/fuentes-financiamiento/fuentes-financiamiento.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateFuenteFinanciamientoPayload,
  QueryFuentesFinanciamiento,
  UpdateFuenteFinanciamientoPayload,
} from "@/features/fuentes-financiamiento/fuentes-financiamiento.types"

export const fuentesKeys = {
  all: ["fuentes-financiamiento"] as const,
  lista: (query: QueryFuentesFinanciamiento) =>
    ["fuentes-financiamiento", "lista", query] as const,
}

export function useFuentes(query: QueryFuentesFinanciamiento) {
  return useQuery({
    queryKey: fuentesKeys.lista(query),
    queryFn: () => listarFuentes(query),
    placeholderData: keepPreviousData,
  })
}

/** Fuentes activas para el selector de Ingresos (cuando se construya). */
export function useFuentesActivas() {
  return useQuery({
    queryKey: fuentesKeys.lista({ page: 1, pageSize: 100, activo: true }),
    queryFn: () => listarFuentes({ page: 1, pageSize: 100, activo: true }),
    // Selector de formulario: ordenado por nombre (el listado va por fecha).
    select: (resultado) =>
      [...resultado.data].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    staleTime: 5 * 60_000,
  })
}

function useInvalidarFuentes() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: fuentesKeys.all })
}

export function useCrearFuente() {
  const invalidar = useInvalidarFuentes()

  return useMutation({
    mutationFn: (payload: CreateFuenteFinanciamientoPayload) =>
      crearFuente(payload),
    onSuccess: (fuente) => {
      invalidar()
      toast.success(`Fuente "${fuente.nombre}" creada`)
    },
    // El error tipico es el 409 por nombre repetido: se muestra tal cual.
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarFuente() {
  const invalidar = useInvalidarFuentes()

  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: UpdateFuenteFinanciamientoPayload & { id: number }) =>
      actualizarFuente(id, payload),
    onSuccess: (fuente) => {
      invalidar()
      toast.success(`Fuente "${fuente.nombre}" actualizada`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDesactivarFuente() {
  const invalidar = useInvalidarFuentes()

  return useMutation({
    mutationFn: (id: number) => desactivarFuente(id),
    onSuccess: (fuente) => {
      invalidar()
      toast.success(`Fuente "${fuente.nombre}" desactivada`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
