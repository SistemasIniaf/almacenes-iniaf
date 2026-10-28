import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { useEnviarEgreso } from "@/features/egresos/hooks/useEgresos"
import { useMiAprobador } from "@/features/usuarios/useUsuarios"

type EnviarDialogProps = {
  onClose: () => void
  /** Se llama tras enviar con éxito (para navegar o cerrar). */
  onEnviado?: () => void
} & (
  | { egresoId: number; crearPedido?: never; onGuardadoSinEnviar?: never }
  | {
      egresoId?: never
      /**
       * «Guardar y enviar» de un pedido NUEVO: al confirmar, primero lo crea
       * (devuelve su id) y recién después lo envía. Confirmar ANTES de crear
       * es a propósito: si el solicitante cancela, no queda un pedido creado
       * que no pidió.
       */
      crearPedido: () => Promise<number>
      /**
       * Se creó pero el envío falló (sin disponible, sin ítems…): el pedido
       * ya existe, pendiente de envío, y el error lo dice el toast.
       */
      onGuardadoSinEnviar: () => void
    }
)

/**
 * Confirma el envío del pedido y dice A QUIÉN le llega. Enviar es un paso sin
 * vuelta atrás —el solicitante ya no puede cancelarlo ni editarlo (decisión del
 * encargado, 2026-07-29)— así que no puede dispararse de un solo clic.
 *
 * El destinatario se consulta al abrir, no antes: es el único momento en que
 * hace falta.
 */
export function EnviarDialog({
  egresoId,
  onClose,
  onEnviado,
  crearPedido,
  onGuardadoSinEnviar,
}: EnviarDialogProps) {
  const enviar = useEnviarEgreso()
  const { data: aprobador, isPending } = useMiAprobador()
  // Cubre también la creación, que no es una mutación de este diálogo: sin
  // esto, el botón quedaba habilitado mientras se creaba el pedido.
  const [ocupado, setOcupado] = useState(false)

  async function confirmar() {
    setOcupado(true)
    let id = egresoId
    try {
      if (crearPedido) id = await crearPedido()
    } catch {
      // No se creó nada: el toast lo emite la mutación y el formulario sigue
      // como estaba para corregir.
      setOcupado(false)
      onClose()
      return
    }
    try {
      await enviar.mutateAsync(id as number)
      onEnviado?.()
      onClose()
    } catch {
      setOcupado(false)
      if (crearPedido) {
        onGuardadoSinEnviar?.()
        onClose()
      }
    }
  }

  return (
    <AlertDialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Enviar el pedido?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {isPending ? (
                <Skeleton className="h-5 w-64" />
              ) : aprobador ? (
                <div>
                  <p>La solicitud será enviada a:</p>
                  <p className="mt-1 font-medium text-foreground">
                    {aprobador.nombre}
                  </p>
                  {/* El cargo va TAL CUAL está guardado (en mayúsculas, como
                      todos los cargos del sistema). Capitalizarlo automáticamente
                      rompería los que llevan números romanos o siglas: «TÉCNICO
                      III» se convertiría en «Técnico Iii». */}
                  {aprobador.cargo && (
                    <p className="text-xs">{aprobador.cargo}</p>
                  )}
                </div>
              ) : (
                // Sin aprobador activo el pedido se envía igual y queda esperando:
                // no hay suplencia (decisión del encargado). Avisarlo antes evita
                // que el solicitante se pregunte por qué no avanza.
                <p className="text-destructive">
                  Tu unidad no tiene un aprobador activo designado. La solicitud
                  quedará esperando hasta que se designe uno.
                </p>
              )}
              <p>
                Una vez enviada, no podrás editarla ni cancelarla. Si es
                necesario realizar alguna corrección, el aprobador deberá
                rechazar la solicitud para que puedas modificarla y volver a
                enviarla.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={ocupado}
            onClick={(event) => {
              event.preventDefault()
              void confirmar()
            }}
          >
            {crearPedido ? "Guardar y enviar" : "Enviar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
