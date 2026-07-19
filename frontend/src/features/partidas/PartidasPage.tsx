import { useMemo, useState } from "react"
import { ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { PartidaNodo } from "@/features/partidas/PartidaNodo"
import {
  contarNodos,
  filtrarArbol,
  idsDelArbol,
} from "@/features/partidas/partidas.filtros"
import {
  useArbolPartidas,
  useCambiarEstadoPartida,
} from "@/features/partidas/usePartidas"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"

import type { PartidaArbol } from "@/features/partidas/partidas.types"

export function PartidasPage() {
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "partidasEscribir")

  const [busqueda, setBusqueda] = useState("")
  const [soloSeleccionables, setSoloSeleccionables] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [aDesactivar, setADesactivar] = useState<PartidaArbol | null>(null)

  // El filtrado es local: el arbol completo ya vino en una sola peticion.
  const busquedaDiferida = useDebouncedValue(busqueda, 200)
  const { data: arbol, isPending, isError, error } = useArbolPartidas()
  const cambiarEstado = useCambiarEstadoPartida()

  const hayFiltro = busquedaDiferida.trim() !== "" || soloSeleccionables

  const arbolFiltrado = useMemo(
    () => filtrarArbol(arbol ?? [], busquedaDiferida, soloSeleccionables),
    [arbol, busquedaDiferida, soloSeleccionables]
  )

  // Con filtro activo se expande todo: si no, las coincidencias quedarian
  // escondidas dentro de nodos colapsados y pareceria que no hay resultados.
  const idsVisibles = useMemo(
    () => idsDelArbol(arbolFiltrado),
    [arbolFiltrado]
  )
  const expandidosEfectivos = hayFiltro ? new Set(idsVisibles) : expandidos

  function alternarNodo(id: number) {
    setExpandidos((previos) => {
      const siguiente = new Set(previos)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }

  async function confirmarDesactivacion() {
    if (!aDesactivar) return
    try {
      await cambiarEstado.mutateAsync({ id: aDesactivar.id, activar: false })
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setADesactivar(null)
    }
  }

  const totalVisible = contarNodos(arbolFiltrado)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partidas</h1>
        <p className="text-sm text-muted-foreground">
          Clasificador por Objeto del Gasto. No se crean ni editan acá: vienen
          del catálogo oficial. Solo se pueden activar o desactivar.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por código o denominación..."
            className="pl-9"
            aria-label="Buscar partidas"
          />
        </div>

        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox
            checked={soloSeleccionables}
            onCheckedChange={(marcado) =>
              setSoloSeleccionables(marcado === true)
            }
          />
          Solo asignables
        </label>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandidos(new Set(idsDelArbol(arbol ?? [])))}
            disabled={hayFiltro || !arbol}
          >
            <ChevronsUpDown className="size-4" />
            Expandir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandidos(new Set())}
            disabled={hayFiltro || !arbol}
          >
            <ChevronsDownUp className="size-4" />
            Contraer
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        {isPending && (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 8 }).map((_, fila) => (
              <Skeleton key={fila} className="h-7 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <p className="py-8 text-center text-sm text-destructive">
            {getApiErrorMessage(error, "No se pudo cargar el catálogo.")}
          </p>
        )}

        {!isPending && !isError && arbolFiltrado.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ninguna partida coincide con la búsqueda.
          </p>
        )}

        {arbolFiltrado.map((partida) => (
          <PartidaNodo
            key={partida.id}
            partida={partida}
            profundidad={0}
            expandidos={expandidosEfectivos}
            onToggle={alternarNodo}
            puedeEscribir={puedeEscribir}
            onActivar={(nodo) =>
              cambiarEstado.mutate({ id: nodo.id, activar: true })
            }
            onDesactivar={setADesactivar}
          />
        ))}
      </div>

      {arbol && (
        <p className="text-sm text-muted-foreground">
          {hayFiltro
            ? `${totalVisible} partidas coinciden`
            : `${totalVisible} partidas en el catálogo`}
        </p>
      )}

      <AlertDialog
        open={aDesactivar !== null}
        onOpenChange={(abierto) => !abierto && setADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar la partida {aDesactivar?.codigo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              «{aDesactivar?.denominacion}» dejará de poder asignarse a ítems
              nuevos. Los ítems que ya la usan no se modifican.
              {aDesactivar && aDesactivar.hijos.length > 0 && (
                <>
                  {" "}
                  Sus {aDesactivar.hijos.length} partidas hijas{" "}
                  <strong>no</strong> se desactivan: cada nodo se gestiona por
                  separado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cambiarEstado.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                // Sin esto el dialogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarDesactivacion()
              }}
              disabled={cambiarEstado.isPending}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
