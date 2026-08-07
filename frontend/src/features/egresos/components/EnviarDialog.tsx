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
import { Skeleton } from "@/components/ui/skeleton"
import { useEnviarEgreso } from "@/features/egresos/hooks/useEgresos"
import { useMiAprobador } from "@/features/usuarios/useUsuarios"

interface EnviarDialogProps {
  egresoId: number
  onClose: () => void
  /** Se llama tras enviar con éxito (para navegar o cerrar). */
  onEnviado?: () => void
}

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
}: EnviarDialogProps) {
  const enviar = useEnviarEgreso()
  const { data: aprobador, isPending } = useMiAprobador()

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
          <AlertDialogCancel disabled={enviar.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={enviar.isPending}
            onClick={(event) => {
              event.preventDefault()
              void enviar
                .mutateAsync(egresoId)
                .then(() => {
                  onEnviado?.()
                  onClose()
                })
                .catch(() => undefined)
            }}
          >
            Enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
