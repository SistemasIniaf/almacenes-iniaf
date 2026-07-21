import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarUnidad,
  crearUnidad,
  desactivarUnidad,
  listarUnidades,
  obtenerArbolUnidades,
} from "@/features/unidades/unidades.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateUnidadPayload,
  QueryUnidades,
  UnidadArbol,
  UpdateUnidadPayload,
} from "@/features/unidades/unidades.types"

/** Prefijo unico de cache; cada listado se cachea por su combinacion de filtros. */
export const unidadesKeys = {
  all: ["unidades"] as const,
  lista: (query: QueryUnidades) => ["unidades", "lista", query] as const,
  arbol: (soloActivas?: boolean) => ["unidades", "arbol", soloActivas] as const,
  selector: () => ["unidades", "selector"] as const,
}

export function useUnidades(query: QueryUnidades) {
  return useQuery({
    queryKey: unidadesKeys.lista(query),
    queryFn: () => listarUnidades(query),
    // Mantiene la pagina anterior visible mientras carga la nueva (sin parpadeo).
    placeholderData: keepPreviousData,
  })
}

/** Arbol jerarquico completo de unidades (para la vista de arbol). */
export function useArbolUnidades(soloActivas?: boolean) {
  return useQuery({
    queryKey: unidadesKeys.arbol(soloActivas),
    queryFn: () => obtenerArbolUnidades({ soloActivas }),
    staleTime: 5 * 60_000, // 5 min
  })
}

/**
 * Unidades activas para poblar selectores (ej. el formulario de usuarios).
 * La institucion tiene decenas de unidades, no miles: una sola pagina alcanza.
 */
export function useUnidadesActivas() {
  return useQuery({
    queryKey: unidadesKeys.lista({ page: 1, pageSize: 100, activo: true }),
    queryFn: () => listarUnidades({ page: 1, pageSize: 100, activo: true }),
    select: (resultado) => resultado.data,
    staleTime: 5 * 60_000,
  })
}

/** Unidades activas en formato plano con indentacion para el selector de padre. */
export function useUnidadesParaSelector() {
  return useQuery({
    queryKey: unidadesKeys.selector(),
    queryFn: async () => {
      const arbol = await obtenerArbolUnidades({ soloActivas: true })
      return aplanarArbolConIndentacion(arbol, 0)
    },
    staleTime: 5 * 60_000,
  })
}

interface UnidadParaSelector {
  id: number
  nombre: string
  sigla: string
  /** Nombre con indentacion visual para mostrar la jerarquia. */
  nombreIndentado: string
}

/** Aplana el arbol en una lista ordenada con indentacion visual. */
function aplanarArbolConIndentacion(
  nodos: UnidadArbol[],
  nivel: number
): UnidadParaSelector[] {
  const resultado: UnidadParaSelector[] = []
  for (const nodo of nodos) {
    resultado.push({
      id: nodo.id,
      nombre: nodo.nombre,
      sigla: nodo.sigla,
      nombreIndentado: "—".repeat(nivel) + (nivel > 0 ? " " : "") + nodo.nombre,
    })
    resultado.push(...aplanarArbolConIndentacion(nodo.hijos, nivel + 1))
  }
  return resultado
}

/** Invalida TODO el arbol de unidades: cualquier filtro/pagina queda obsoleto. */
function useInvalidarUnidades() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: unidadesKeys.all })
}

export function useCrearUnidad() {
  const invalidar = useInvalidarUnidades()

  return useMutation({
    mutationFn: (payload: CreateUnidadPayload) => crearUnidad(payload),
    onSuccess: (unidad) => {
      invalidar()
      toast.success(`Unidad "${unidad.nombre}" creada`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarUnidad() {
  const invalidar = useInvalidarUnidades()

  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateUnidadPayload & { id: number }) =>
      actualizarUnidad(id, payload),
    onSuccess: (unidad) => {
      invalidar()
      toast.success(`Unidad "${unidad.nombre}" actualizada`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDesactivarUnidad() {
  const invalidar = useInvalidarUnidades()

  return useMutation({
    mutationFn: (id: number) => desactivarUnidad(id),
    onSuccess: (unidad) => {
      invalidar()
      toast.success(`Unidad "${unidad.nombre}" desactivada`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
