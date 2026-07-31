import { BadgeEstado } from "@/components/data/BadgeEstado"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { HistorialEgreso } from "@/features/egresos/components/HistorialEgreso"
import {
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"
import { useEgreso } from "@/features/egresos/hooks/useEgresos"
import { getApiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * ANCHO DEL PANEL — cambiá SOLO esta línea para probar otro tamaño.
 *
 *   sm:max-w-2xl! →  672 px      sm:max-w-5xl! → 1024 px
 *   sm:max-w-3xl! →  768 px      sm:max-w-6xl! → 1152 px
 *   sm:max-w-4xl! →  896 px      sm:max-w-7xl! → 1280 px
 *
 * También acepta una medida exacta (`sm:max-w-[1100px]!`) o un porcentaje de la
 * pantalla (`sm:max-w-[75vw]!`), que se adapta al monitor de cada uno.
 *
 * ⚠️ El `!` del final NO es decorativo. `SheetContent` trae
 * `data-[side=right]:sm:max-w-sm`, un selector con MÁS especificidad que un
 * `sm:max-w-*` común: sin el important el panel se queda clavado en 384 px y
 * cambiar el número acá no hace absolutamente nada. Es el mismo motivo por el
 * que el ancho base necesita `data-[side=right]:w-full`.
 *
 * Abajo de `sm` no rige: ahí el panel va de borde a borde.
 */
const ANCHO_PANEL = "sm:max-w-lg!"

interface HistorialSheetProps {
  egresoId: number
  onClose: () => void
}

/**
 * Historial del pedido en un panel lateral, para verlo DESDE el listado sin
 * entrar a la ficha: quién movió el pedido y cuándo es lo que más se consulta,
 * y hasta ahora costaba dos navegaciones.
 *
 * El historial no viaja en el listado (`GET /egresos` devuelve la forma
 * liviana), así que el panel pide el detalle al abrirse. Se monta solo cuando
 * se abre, así esa consulta no sale por cada fila de la tabla.
 */
export function HistorialSheet({ egresoId, onClose }: HistorialSheetProps) {
  const { data: egreso, isPending, isError, error } = useEgreso(egresoId)

  return (
    <Sheet open onOpenChange={(abierto) => !abierto && onClose()}>
      {/* Tres cosas que este panel le cambia al `SheetContent` de shadcn:

          1. ANCHO. `data-[side=right]:w-full` y no un `w-full` pelado: el
             componente trae `data-[side=right]:w-3/4`, que es un selector
             distinto y por eso un `w-full` común no lo pisa — el panel se
             quedaba en el 75 % de la pantalla con una franja muerta al costado.
             El tope lo pone `ANCHO_PANEL`, arriba.
          2. FONDO GRIS. Las tarjetas de la línea de tiempo son blancas y
             necesitan un lienzo que las separe; sobre el `bg-popover` del
             componente quedaban fundidas. Es un gris SÓLIDO: el panel va montado
             sobre el overlay oscuro del Sheet, así que cualquier transparencia
             lo oscurece en vez de aclararlo. En oscuro va al revés — el panel
             más hundido que las tarjetas, que usan `bg-card`.
          3. La «X» de cerrar es del propio componente; se la pinta de rojo
             apuntando a su `data-slot`, para no tener que tocar el archivo de
             shadcn (que se regenera con el CLI). */}
      <SheetContent
        side="right"
        className={cn(
          "gap-0 bg-zinc-50 data-[side=right]:w-full dark:bg-zinc-950",
          "[&_[data-slot=sheet-close]]:text-destructive [&_[data-slot=sheet-close]]:hover:bg-destructive/10 [&_[data-slot=sheet-close]]:hover:text-destructive",
          ANCHO_PANEL
        )}
      >
        <SheetHeader>
          <SheetTitle>Historial del pedido</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              {egreso ? (
                <>
                  <span className="font-medium text-foreground">
                    {etiquetaNumero(egreso)}
                  </span>
                  <BadgeEstado tono={ESTADO_PUNTO[egreso.estado]}>
                    {ESTADO_LABEL[egreso.estado]}
                  </BadgeEstado>
                  <span>{egreso.unidad.sigla}</span>
                </>
              ) : (
                <Skeleton className="h-5 w-40" />
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isPending && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(error, "No se pudo cargar el historial.")}
            </p>
          )}

          {egreso && <HistorialEgreso historial={egreso.historial} />}
        </div>

        <SheetFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
