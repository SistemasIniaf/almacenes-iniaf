import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarIngreso,
  anularIngreso,
  crearIngreso,
  listarIngresos,
  obtenerIngreso,
} from "@/features/ingresos/ingresos.api"
import { obtenerAlmacen } from "@/features/almacenes/almacenes.api"
import { listarItems } from "@/features/items/items.api"
import { listarSolicitadores } from "@/features/usuarios/usuarios.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateIngresoPayload,
  QueryIngresos,
  UpdateIngresoPayload,
} from "@/features/ingresos/ingresos.types"

export const ingresosKeys = {
  all: ["ingresos"] as const,
  lista: (query: QueryIngresos) => ["ingresos", "lista", query] as const,
  detalle: (id: number) => ["ingresos", "detalle", id] as const,
}

export function useIngresos(query: QueryIngresos) {
  return useQuery({
    queryKey: ingresosKeys.lista(query),
    queryFn: () => listarIngresos(query),
    placeholderData: keepPreviousData,
  })
}

export function useIngreso(id: number | undefined) {
  return useQuery({
    queryKey: ingresosKeys.detalle(id ?? 0),
    queryFn: () => obtenerIngreso(id as number),
    enabled: id != null,
  })
}

function useInvalidarIngresos() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ingresosKeys.all })
}

export function useCrearIngreso() {
  const invalidar = useInvalidarIngresos()
  return useMutation({
    mutationFn: (payload: CreateIngresoPayload) => crearIngreso(payload),
    onSuccess: () => {
      invalidar()
      toast.success("Ingreso registrado")
    },
    // El backend lista lo que falta si no se puede registrar.
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarIngreso() {
  const invalidar = useInvalidarIngresos()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateIngresoPayload & { id: number }) =>
      actualizarIngreso(id, payload),
    onSuccess: () => {
      invalidar()
      toast.success("Cambios guardados")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useAnularIngreso() {
  const invalidar = useInvalidarIngresos()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      anularIngreso(id, motivo),
    onSuccess: () => {
      invalidar()
      toast.success("Ingreso anulado")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

// ---------------------------------------------------------------------------
// Selectores auxiliares del formulario
// ---------------------------------------------------------------------------

/** Solicitadores activos (para el selector de responsable / comisión de recepción). */
export function useSolicitadores() {
  return useQuery({
    queryKey: ["usuarios", "solicitadores"],
    queryFn: listarSolicitadores,
    staleTime: 5 * 60_000,
  })
}

/** Unidades que muestra un almacén (para el selector de unidad solicitante). */
export function useUnidadesDeAlmacen(almacenId: number | undefined) {
  return useQuery({
    queryKey: ["almacenes", "unidades", almacenId],
    queryFn: () => obtenerAlmacen(almacenId as number),
    select: (almacen) => almacen.unidades,
    enabled: almacenId != null,
    staleTime: 60_000,
  })
}

/** Cuántos ítems trae cada tanda del selector de líneas. */
export const ITEMS_POR_BUSQUEDA = 50

/**
 * Ítems del catálogo para el selector de líneas: **búsqueda contra el servidor,
 * paginada de a tandas** (el combo pide la siguiente al llegar al final).
 *
 * El catálogo real del INIAF tiene ~23.000 ítems, así que nunca se trae entero:
 * se piden 50 por vez (`q` resuelto en el backend, sin acentos y con índice GIN
 * sobre código + descripción). Sin término se muestran los primeros por
 * descripción, solo para que la lista no arranque vacía.
 *
 * Paginar acá es seguro porque el backend desempata el orden por `id`: sin ese
 * desempate, dos ítems con la misma descripción podrían repetirse o perderse
 * entre tandas.
 */
export function useBuscarItems(termino: string) {
  return useInfiniteQuery({
    queryKey: ["items", "buscar", termino],
    queryFn: ({ pageParam }) =>
      listarItems({
        page: pageParam,
        pageSize: ITEMS_POR_BUSQUEDA,
        activo: true,
        orden: "descripcion",
        q: termino || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (ultima) =>
      ultima.meta.page < ultima.meta.totalPages ? ultima.meta.page + 1 : undefined,
    // Mantiene la lista anterior mientras llega la nueva: al tipear, el combo no
    // parpadea a vacío entre términos.
    placeholderData: keepPreviousData,
    // `gcTime: 0` descarta las tandas apiladas apenas el término deja de estar
    // en uso. Sin esto, volver a un término ya visitado (típico: vaciar el
    // filtro) revive de la caché las 300 o 500 filas que habías cargado ahí, en
    // vez de arrancar en 50 como cualquier otra búsqueda. La primera tanda se
    // vuelve a pedir, que son ~200 ms.
    gcTime: 0,
  })
}
