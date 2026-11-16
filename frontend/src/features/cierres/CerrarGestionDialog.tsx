import { useState } from "react"
import { toast } from "sonner"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useCerrarGestion } from "@/features/cierres/useCierres"
import { getApiErrorMessage } from "@/lib/api"

import type { Cierre, EstadoAlmacen } from "@/features/cierres/cierres.types"

interface CerrarGestionDialogProps {
  fila: EstadoAlmacen
  onClose: () => void
  /** Tras cerrar: la página ofrece abrir el acta. */
  onCerrado: (cierre: Cierre) => void
}

/**
 * Confirma el cierre. Cerrar NO tiene vuelta atrás (no hay reapertura), así que
 * el diálogo dice exactamente qué se congela. Si la gestión todavía no terminó
 * (cierre anticipado) pide además marcar que se entiende que el almacén queda
 * sin poder registrar nada hasta el 1/1: es lo que exige el backend con
 * `confirmarAnticipado`.
 */
export function CerrarGestionDialog({
  fila,
  onClose,
  onCerrado,
}: CerrarGestionDialogProps) {
  const cerrar = useCerrarGestion()
  const [entendido, setEntendido] = useState(false)
  const gestion = fila.gestionPendiente as number
  const nombre = fila.almacen.nombre

  async function confirmar() {
    try {
      const cierre = await cerrar.mutateAsync({
        almacenId: fila.almacen.id,
        gestion,
        ...(fila.anticipado ? { confirmarAnticipado: true } : {}),
      })
      onCerrado(cierre)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      onClose()
    }
  }

  return (
    <AlertDialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Cerrar la gestión {gestion} de {nombre}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Se guardan los saldos de cada lote al 31/12/{gestion}, tal
                  como figuran en el kardex. Pasan como saldo inicial de{" "}
                  {gestion + 1}.
                </li>
                <li>
                  La gestión {gestion} queda <strong>congelada</strong>: no se
                  podrá registrar, modificar ni anular ningún documento de esa
                  gestión.
                </li>
                <li>
                  <strong>No se puede reabrir.</strong>
                </li>
              </ul>

              {fila.anticipado && (
                <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                  <p>
                    <strong>La gestión {gestion} todavía no terminó.</strong> Si
                    la cerrás ahora, {nombre} no podrá registrar ingresos,
                    entregas ni traspasos hasta el 01/01/{gestion + 1}.
                  </p>
                  <div className="flex items-start gap-2 text-foreground">
                    <Checkbox
                      id="confirmar-anticipado"
                      checked={entendido}
                      onCheckedChange={(v) => setEntendido(v === true)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="confirmar-anticipado"
                      className="leading-snug font-normal"
                    >
                      Entiendo que el almacén queda congelado hasta el 01/01/
                      {gestion + 1}.
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cerrar.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={cerrar.isPending || (fila.anticipado && !entendido)}
            onClick={(event) => {
              event.preventDefault()
              void confirmar()
            }}
          >
            {cerrar.isPending ? "Cerrando…" : `Cerrar gestión ${gestion}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
