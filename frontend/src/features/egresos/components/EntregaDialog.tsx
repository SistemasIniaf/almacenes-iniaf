import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useEntregarEgreso } from "@/features/egresos/hooks/useEgresos"

import type { Egreso } from "@/features/egresos/egresos.types"

interface EntregaDialogProps {
  /**
   * El padre monta este componente SOLO cuando se abre, y por eso no recibe
   * `open`: cada apertura es un montaje nuevo y las cantidades se inicializan
   * en el `useState`. Sincronizarlas con un efecto sería un `setState` dentro
   * de `useEffect`, que el lint del repo (reglas del React Compiler) rechaza.
   */
  onClose: () => void
  egreso: Egreso
}

/**
 * Entrega del material. Es el ÚNICO punto del circuito donde se ajustan
 * cantidades (el jefe de unidad solo aprueba o rechaza).
 *
 * Se arranca proponiendo lo pedido, que es el caso normal. Bajar una cantidad
 * cubre el faltante físico: se entrega menos y el pedido queda entregado con esa
 * cantidad, sin estado intermedio. Cero es válido — negar un ítem sin rechazar
 * el pedido entero.
 */
export function EntregaDialog({ onClose, egreso }: EntregaDialogProps) {
  const entregar = useEntregarEgreso()
  // Arranca proponiendo lo pedido, que es el caso normal.
  const [cantidades, setCantidades] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      egreso.detalles.map((d) => [d.id, String(Number(d.cantidadSolicitada))])
    )
  )

  const excedidas = egreso.detalles.filter((d) => {
    const valor = Number(cantidades[d.id] ?? 0)
    return Number.isNaN(valor) || valor > Number(d.cantidadSolicitada)
  })

  async function confirmar() {
    try {
      await entregar.mutateAsync({
        id: egreso.id,
        lineas: egreso.detalles.map((d) => ({
          detalleId: d.id,
          cantidadEntregada: Number(cantidades[d.id] ?? 0),
        })),
      })
      onClose()
    } catch {
      // El toast lo emite la mutación (ej. el lote se quedó sin saldo); el
      // diálogo se queda abierto para bajar la cantidad.
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Entregar material</DialogTitle>
          <DialogDescription>
            Al confirmar se descuenta el stock de cada lote y queda la salida en
            el Kardex. Si de algo hay menos de lo que dice el sistema, bajá la
            cantidad.
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ítem</TableHead>
              <TableHead className="text-right">Pedido</TableHead>
              <TableHead className="w-32 text-right">Entrega</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {egreso.detalles.map((detalle) => {
              const item = detalle.ingresoDetalle.item
              const pedido = Number(detalle.cantidadSolicitada)
              const valor = Number(cantidades[detalle.id] ?? 0)
              return (
                <TableRow key={detalle.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{item.descripcion}</span>
                      <span className="text-xs text-muted-foreground">
                        {detalle.ingresoDetalle.ingreso.fuenteFinanciamiento
                          ?.nombre ?? "Sin fuente"}
                        {" · saldo del lote: "}
                        {Number(detalle.ingresoDetalle.saldoCantidad)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {pedido} {item.unidadMedida}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      // `any` y no "0.01": con un paso decimal las flechas
                      // mueven de a un centésimo, que no es como se entrega
                      // material. Así se mueven de a 1 y los decimales se
                      // siguen pudiendo escribir (hay ítems en kilos y litros).
                      step="any"
                      min={0}
                      max={pedido}
                      value={cantidades[detalle.id] ?? ""}
                      onChange={(event) =>
                        setCantidades((previas) => ({
                          ...previas,
                          [detalle.id]: event.target.value,
                        }))
                      }
                      aria-invalid={valor > pedido}
                      className="text-right"
                      aria-label={`Cantidad a entregar de ${item.descripcion}`}
                      // Misma guarda que `NumberField`: sin esto, scrollear la
                      // página con el puntero sobre el campo le cambia el valor.
                      onWheel={(event) => event.currentTarget.blur()}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {excedidas.length > 0 && (
          <p className="text-sm text-destructive">
            No se puede entregar más de lo pedido. Revisá las cantidades
            marcadas.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={entregar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void confirmar()}
            disabled={entregar.isPending || excedidas.length > 0}
          >
            {entregar.isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
