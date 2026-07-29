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
      toast.success("Pedido creado como borrador")
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
      toast.success("Borrador guardado")
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
      toast.success("Borrador descartado")
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
        `Pedido ${String(egreso.numero).padStart(3, "0")}/${egreso.gestion} enviado al jefe de unidad`
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
