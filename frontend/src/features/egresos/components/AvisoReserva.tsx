import { Clock, TimerOff } from "lucide-react"

import { estadoReserva } from "@/features/egresos/egresos.types"
import { cn } from "@/lib/utils"

import type { EgresoListItem } from "@/features/egresos/egresos.types"

// En 24 h: «22:42» y no «10:42 p. m.», que pegado al punto final de la frase
// quedaba «p. m..». Es el mismo formato del mensaje del backend al anular un
// ingreso reservado.
const fechaHora = (fecha: Date) =>
  fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

/** Menos de esto para vencer, el aviso pasa a ámbar: ya conviene apurarse. */
const HORAS_AVISO = 12

interface AvisoReservaProps {
  egreso: Pick<EgresoListItem, "estado" | "reservaVence">
  cantidadItems: number
  /**
   * `compacto`: una línea bajo el estado, en el listado. Si no, el recuadro de
   * la ficha, que además explica qué pasa al vencer.
   */
  compacto?: boolean
}

/**
 * En qué anda la reserva de 48 h de un pedido PENDIENTE DE ENVÍO (2026-10-27).
 * Si el solicitante no lo envía a tiempo, el sistema le quita los ítems y tiene
 * que volver a elegirlos — y eso no puede enterarlo recién al fallar: es la
 * regla del contador en la venta de entradas, el plazo se ve antes de vencer.
 *
 * No dibuja nada fuera de «pendiente de envío»: enviado, el reloj no corre.
 */
export function AvisoReserva({
  egreso,
  cantidadItems,
  compacto = false,
}: AvisoReservaProps) {
  // Se evalúa en cada render (como la gestión en curso de `NumeroDocumento`):
  // una ficha abierta un buen rato pasa sola de «vigente» a «vencida» en el
  // próximo refresco de la consulta. Un solo `ahora` para las dos cuentas.
  const ahora = new Date()
  const reserva = estadoReserva(egreso, cantidadItems, ahora)
  if (!reserva) return null

  const pronto =
    reserva.tipo === "vigente" &&
    reserva.vence.getTime() - ahora.getTime() < HORAS_AVISO * 60 * 60 * 1000
  const alerta = reserva.tipo !== "vigente"

  if (compacto) {
    return (
      <p
        className={cn(
          "mt-1 flex items-center gap-1 text-xs",
          alerta
            ? "text-destructive"
            : pronto
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
        )}
      >
        {alerta ? (
          <TimerOff className="size-3" />
        ) : (
          <Clock className="size-3" />
        )}
        {reserva.tipo === "vigente"
          ? `Reserva hasta ${fechaHora(reserva.vence)}`
          : reserva.tipo === "vencida"
            ? "Reserva vencida"
            : "Sin ítems: hay que elegirlos"}
      </p>
    )
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border p-3 text-sm",
        alerta
          ? "border-destructive/40 bg-destructive/5"
          : pronto
            ? "border-amber-500/40 bg-amber-500/5"
            : "bg-muted/30"
      )}
    >
      {alerta ? (
        <TimerOff className="mt-0.5 size-4 shrink-0 text-destructive" />
      ) : (
        <Clock
          className={cn(
            "mt-0.5 size-4 shrink-0",
            pronto ? "text-amber-600 dark:text-amber-400" : "text-primary"
          )}
        />
      )}
      <p>
        {reserva.tipo === "vigente" && (
          <>
            El material queda reservado hasta el{" "}
            <span className="font-medium">{fechaHora(reserva.vence)}</span>. Si
            el pedido no se envía antes, se le quitan los ítems y hay que volver
            a elegirlos.
          </>
        )}
        {reserva.tipo === "vencida" && (
          <>
            La reserva venció el{" "}
            <span className="font-medium">{fechaHora(reserva.vence)}</span>: el
            material ya no está reservado y estos ítems se van a quitar. Para
            seguir, hay que volver a elegirlos.
          </>
        )}
        {reserva.tipo === "vacio" && (
          <>
            Venció la reserva y se quitaron los ítems.{" "}
            <span className="font-medium">Elegí de nuevo lo que necesitás</span>
            : al guardar, el material queda reservado otras 48 horas.
          </>
        )}
      </p>
    </div>
  )
}
