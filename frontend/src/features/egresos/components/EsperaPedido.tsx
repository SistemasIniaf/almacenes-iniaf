import { formatDistanceStrict } from "date-fns"
import { es } from "date-fns/locale"
import { Hourglass, UserX } from "lucide-react"

import { useAuth } from "@/features/auth/hooks/useAuth"
import { ROL_ESPERA_LABEL } from "@/features/egresos/egresos.types"
import { cn } from "@/lib/utils"

import type { EgresoListItem } from "@/features/egresos/egresos.types"

const fechaHora = (fecha: Date) =>
  fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

/** Sin nadie designado, qué es lo que falta, dicho por quién lo designa. */
const SIN_DESIGNAR = {
  aprobador:
    "La unidad no tiene un aprobador de unidad activo: el pedido no va a avanzar hasta que se designe uno.",
  responsable_almacen:
    "El almacén no tiene un encargado activo: el pedido no va a avanzar hasta que se designe uno.",
} as const

interface EsperaPedidoProps {
  egreso: Pick<EgresoListItem, "espera">
  /** `compacto`: una línea bajo el estado, en el listado. Si no, el recuadro de la ficha. */
  compacto?: boolean
}

/**
 * Con QUIÉN está el pedido y desde hace cuánto (2026-10-29, pedido del
 * usuario). El tiempo es la mitad del dato: «lo tiene Pedro» no dice si hay
 * que llamarlo; «hace 6 días», sí.
 *
 * No dibuja nada si el pedido está cerrado, ni si lo tiene el propio usuario
 * como solicitante: ahí ya hablan el aviso de la reserva y el de devuelto.
 */
export function EsperaPedido({ egreso, compacto = false }: EsperaPedidoProps) {
  const { user } = useAuth()
  const { espera } = egreso
  if (!espera) return null

  const esMio = espera.persona?.id === user?.id
  if (esMio && espera.rol === "solicitante") return null

  // En cada render, como el aviso de la reserva: una pantalla abierta un rato
  // se actualiza sola en el próximo refresco de la consulta.
  const desde = new Date(espera.desde)
  const hace = formatDistanceStrict(desde, new Date(), { locale: es })
  const sinDesignar = espera.persona == null && espera.rol !== "solicitante"

  if (compacto) {
    return (
      <p
        className={cn(
          "mt-1 flex max-w-80 items-center gap-1 text-xs",
          sinDesignar ? "text-destructive" : "text-muted-foreground"
        )}
        title={
          espera.persona
            ? `${espera.persona.nombre} · ${espera.persona.usuario} (${ROL_ESPERA_LABEL[espera.rol]}) desde el ${fechaHora(desde)}`
            : undefined
        }
      >
        {sinDesignar ? (
          <UserX className="size-3 shrink-0" />
        ) : (
          <Hourglass className="size-3 shrink-0" />
        )}
        {sinDesignar || esMio ? (
          <span className="truncate">
            {sinDesignar
              ? `Sin ${ROL_ESPERA_LABEL[espera.rol]} designado`
              : `Te espera hace ${hace}`}
          </span>
        ) : (
          <>
            {/* Si no entra, se corta el NOMBRE: el usuario y el tiempo son lo
                que identifica y lo que importa. */}
            <span className="truncate">Con {espera.persona?.nombre}</span>
            <span className="shrink-0">
              ({espera.persona?.usuario}) · hace {hace}
            </span>
          </>
        )}
      </p>
    )
  }

  if (sinDesignar) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <UserX className="mt-0.5 size-4 shrink-0 text-destructive" />
        <p>
          {SIN_DESIGNAR[espera.rol as keyof typeof SIN_DESIGNAR]} Espera desde
          el <span className="font-medium">{fechaHora(desde)}</span> (hace{" "}
          {hace}).
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm">
      <Hourglass className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>
        {esMio ? (
          "Espera tu decisión"
        ) : (
          <>
            Esperando a{" "}
            <span className="font-medium">{espera.persona?.nombre}</span>{" "}
            <span className="text-muted-foreground">
              (
              <span className="text-foreground">{espera.persona?.usuario}</span>{" "}
              · {ROL_ESPERA_LABEL[espera.rol]}
              {espera.persona?.cargo ? ` · ${espera.persona.cargo}` : ""})
            </span>
          </>
        )}{" "}
        desde el <span className="font-medium">{fechaHora(desde)}</span> (hace{" "}
        {hace}).
      </p>
    </div>
  )
}
