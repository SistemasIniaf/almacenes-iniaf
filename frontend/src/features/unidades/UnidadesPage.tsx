import { useMemo, useState } from "react"
import { ChevronsDownUp, ChevronsUpDown, Plus, Search } from "lucide-react"

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
import { UnidadFormDialog } from "@/features/unidades/UnidadFormDialog"
import { UnidadNodo } from "@/features/unidades/UnidadNodo"
import {
  contarDescendientes,
  contarNodos,
  filtrarArbol,
  idsDelArbol,
} from "@/features/unidades/unidades.filtros"
import {
  useActualizarUnidad,
  useArbolUnidades,
  useDesactivarUnidad,
} from "@/features/unidades/useUnidades"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"

import type { UnidadArbol } from "@/features/unidades/unidades.types"

export function UnidadesPage() {
  const { user } = useAuth()
  const puedeEscribir = tienePermiso(user, "unidadesEscribir")

  const [busqueda, setBusqueda] = useState("")
  const [soloActivas, setSoloActivas] = useState(false)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [dialogoAbierto, setDialogoAbierto] = useState(false)
  const [unidadEnEdicion, setUnidadEnEdicion] = useState<UnidadArbol | null>(
    null
  )
  const [aDesactivar, setADesactivar] = useState<UnidadArbol | null>(null)

  // El filtrado es local: el arbol completo ya vino en una sola peticion.
  const busquedaDiferida = useDebouncedValue(busqueda, 200)
  const { data: arbol, isPending, isError, error } = useArbolUnidades()
  const desactivar = useDesactivarUnidad()
  const activar = useActualizarUnidad()

  const hayFiltro = busquedaDiferida.trim() !== "" || soloActivas

  const arbolFiltrado = useMemo(
    () => filtrarArbol(arbol ?? [], busquedaDiferida, soloActivas),
    [arbol, busquedaDiferida, soloActivas]
  )

  // Se muestra una tabla por grupo (MOF, OTROS...). Cada raíz lleva su grupo.
  const porGrupo = useMemo(() => {
    const mapa = new Map<string, UnidadArbol[]>()
    for (const raiz of arbolFiltrado) {
      const grupo = raiz.grupo ?? "SIN GRUPO"
      const lista = mapa.get(grupo) ?? []
      lista.push(raiz)
      mapa.set(grupo, lista)
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [arbolFiltrado])

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

  function abrirCreacion() {
    setUnidadEnEdicion(null)
    setDialogoAbierto(true)
  }

  function abrirEdicion(unidad: UnidadArbol) {
    setUnidadEnEdicion(unidad)
    setDialogoAbierto(true)
  }

  async function confirmarDesactivacion() {
    if (!aDesactivar) return
    try {
      await desactivar.mutateAsync(aDesactivar.id)
    } catch {
      // El toast de error lo emite la mutacion.
    } finally {
      setADesactivar(null)
    }
  }

  async function handleActivar(unidad: UnidadArbol) {
    try {
      await activar.mutateAsync({ id: unidad.id, activo: true })
    } catch {
      // El toast de error lo emite la mutacion.
    }
  }

  const totalVisible = contarNodos(arbolFiltrado)
  const descendientesADesactivar = aDesactivar
    ? contarDescendientes(aDesactivar)
    : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Unidades</h1>
          <p className="text-sm text-muted-foreground">
            Areas administrativas de la institucion. Estructura jerarquica.
          </p>
        </div>

        {puedeEscribir && (
          <Button onClick={abrirCreacion}>
            <Plus className="size-4" />
            Nueva unidad
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o sigla..."
            className="pl-9"
            aria-label="Buscar unidades"
          />
        </div>

        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <Checkbox
            checked={soloActivas}
            onCheckedChange={(marcado) => setSoloActivas(marcado === true)}
          />
          Solo activas
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

      {isPending && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          {Array.from({ length: 8 }).map((_, fila) => (
            <Skeleton key={fila} className="h-7 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-md border py-8 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "No se pudieron cargar las unidades.")}
        </p>
      )}

      {!isPending && !isError && arbolFiltrado.length === 0 && (
        <p className="rounded-md border py-8 text-center text-sm text-muted-foreground">
          {hayFiltro
            ? "Ninguna unidad coincide con la busqueda."
            : "Todavia no hay unidades registradas."}
        </p>
      )}

      {/* Una tabla por grupo (MOF, OTROS...). */}
      {porGrupo.map(([grupo, raices]) => (
        <div key={grupo} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {grupo}
          </h2>
          <div className="rounded-md border">
            {raices.map((unidad) => (
              <UnidadNodo
                key={unidad.id}
                unidad={unidad}
                profundidad={0}
                expandidos={expandidosEfectivos}
                onToggle={alternarNodo}
                puedeEscribir={puedeEscribir}
                onEditar={abrirEdicion}
                onActivar={handleActivar}
                onDesactivar={setADesactivar}
              />
            ))}
          </div>
        </div>
      ))}

      {arbol && (
        <p className="text-sm text-muted-foreground">
          {hayFiltro
            ? `${totalVisible} unidades coinciden`
            : `${totalVisible} unidades en el sistema`}
        </p>
      )}

      <UnidadFormDialog
        open={dialogoAbierto}
        onOpenChange={setDialogoAbierto}
        unidad={unidadEnEdicion}
      />

      <AlertDialog
        open={aDesactivar !== null}
        onOpenChange={(abierto) => !abierto && setADesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar «{aDesactivar?.nombre}»?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La unidad no se elimina: queda inactiva y deja de poder asignarse
              a usuarios. Podes volver a activarla editandola.
              {aDesactivar && descendientesADesactivar > 0 && (
                <>
                  {" "}
                  <strong>
                    Se desactivaran tambien sus {descendientesADesactivar}{" "}
                    unidad(es) hija(s).
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desactivar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                // Sin esto el dialogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarDesactivacion()
              }}
              disabled={desactivar.isPending}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
