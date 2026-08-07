import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"

import {
  actualizarEgreso,
  anularEgreso,
  aprobarEgreso,
  crearEgreso,
  descartarEgreso,
  enviarEgreso,
  entregarEgreso,
  listarEgresos,
  obtenerEgreso,
  rechazarEgreso,
  resumenEgresos,
} from "@/features/egresos/egresos.api"
import { getApiErrorMessage } from "@/lib/api"

import type {
  CreateEgresoPayload,
  EntregaPayload,
  QueryEgresos,
  UpdateEgresoPayload,
} from "@/features/egresos/egresos.types"

export const egresosKeys = {
  all: ["egresos"] as const,
  lista: (query: QueryEgresos) => ["egresos", "lista", query] as const,
  detalle: (id: number) => ["egresos", "detalle", id] as const,
  resumen: ["egresos", "resumen"] as const,
}

/**
 * Cuántos egresos hay en cada etapa. Lo consumen las pestañas del listado y el
 * badge del menú lateral — que vive en TODAS las pantallas, así que:
 *
 * - `enabled` deja de pedirlo a quien no lo va a mostrar (el menú solo lo usa
 *   para los roles con bandeja propia);
 * - el `staleTime` evita una consulta por cada navegación entre módulos.
 *
 * Cuelga de `egresosKeys.all`, así que toda mutación de egresos ya lo invalida:
 * aprobar un pedido baja el número del menú sin nada más que hacer.
 */
export function useResumenEgresos(opciones?: { enabled?: boolean }) {
  return useQuery({
    queryKey: egresosKeys.resumen,
    queryFn: resumenEgresos,
    enabled: opciones?.enabled ?? true,
    staleTime: 60_000,
  })
}

export function useEgresos(query: QueryEgresos) {
  return useQuery({
    queryKey: egresosKeys.lista(query),
    queryFn: () => listarEgresos(query),
    placeholderData: keepPreviousData,
  })
}

export function useEgreso(id: number | undefined) {
  return useQuery({
    queryKey: egresosKeys.detalle(id as number),
    queryFn: () => obtenerEgreso(id as number),
    enabled: id != null,
  })
}

/**
 * Toda accion sobre un egreso puede mover stock (la entrega lo descuenta, la
 * anulacion lo devuelve) o la reserva (crear, editar, enviar, rechazar,
 * descartar). Por eso se invalida `stock` junto con `egresos` — si no, el
 * disponible que ve el solicitante queda viejo.
 */
function useInvalidarEgresos() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: egresosKeys.all })
    void queryClient.invalidateQueries({ queryKey: ["stock"] })
    void queryClient.invalidateQueries({ queryKey: ["kardex"] })
  }
}

export function useCrearEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: (payload: CreateEgresoPayload) => crearEgreso(payload),
    onSuccess: () => {
      invalidar()
      toast.success("Pedido guardado. Falta enviarlo al aprobador de unidad")
    },
    // Los errores útiles los arma el backend (sin disponible suficiente, lote
    // de otro almacén, ingreso anulado): se muestran tal cual.
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useActualizarEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateEgresoPayload & { id: number }) =>
      actualizarEgreso(id, payload),
    onSuccess: () => {
      invalidar()
      toast.success("Cambios guardados")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useDescartarEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: (id: number) => descartarEgreso(id),
    onSuccess: () => {
      invalidar()
      toast.success("Pedido descartado")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useEnviarEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: (id: number) => enviarEgreso(id),
    onSuccess: (egreso) => {
      invalidar()
      toast.success(
        `Pedido ${String(egreso.numero).padStart(3, "0")}/${egreso.gestion} enviado al aprobador de unidad`
      )
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useAprobarEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: (id: number) => aprobarEgreso(id),
    onSuccess: () => {
      invalidar()
      toast.success("Pedido aprobado: pasa al responsable de almacén")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useRechazarEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      rechazarEgreso(id, motivo),
    onSuccess: () => {
      invalidar()
      toast.success("Pedido rechazado: vuelve al solicitante")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useEntregarEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: ({ id, ...payload }: EntregaPayload & { id: number }) =>
      entregarEgreso(id, payload),
    onSuccess: () => {
      invalidar()
      toast.success("Material entregado y stock descargado")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useAnularEgreso() {
  const invalidar = useInvalidarEgresos()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      anularEgreso(id, motivo),
    onSuccess: () => {
      invalidar()
      toast.success("Egreso anulado: el material volvió a sus lotes")
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
