import { useEffect, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { CheckboxField } from "@/components/form/CheckboxField"
import { InputField } from "@/components/form/InputField"
import { almacenSchema } from "@/features/almacenes/almacenes.schema"
import {
  useActualizarAlmacen,
  useCrearAlmacen,
} from "@/features/almacenes/useAlmacenes"
import { filtrarArbol } from "@/features/unidades/unidades.filtros"
import { useArbolUnidades } from "@/features/unidades/useUnidades"

import type { AlmacenFormValues } from "@/features/almacenes/almacenes.schema"
import type { Almacen } from "@/features/almacenes/almacenes.types"
import type { UnidadArbol } from "@/features/unidades/unidades.types"

interface AlmacenFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `null` = crear; con almacen = editar. */
  almacen: Almacen | null
}

/** Fila de la jerarquía aplanada, con su profundidad y su subárbol (para cascada). */
interface FilaUnidad {
  id: number
  nombre: string
  sigla: string
  profundidad: number
  /** Ids del nodo + todos sus descendientes (tildar el padre marca los hijos). */
  subarbol: number[]
}

const VALORES_INICIALES: AlmacenFormValues = {
  nombre: "",
  activo: true,
  unidadIds: [],
}

/** Ids del nodo y todos sus descendientes. */
function idsSubarbol(nodo: UnidadArbol): number[] {
  return [nodo.id, ...nodo.hijos.flatMap(idsSubarbol)]
}

/** Aplana un árbol a filas con profundidad (para indentar). */
function aplanar(nodo: UnidadArbol, profundidad: number, acc: FilaUnidad[]) {
  acc.push({
    id: nodo.id,
    nombre: nodo.nombre,
    sigla: nodo.sigla,
    profundidad,
    subarbol: idsSubarbol(nodo),
  })
  for (const hijo of nodo.hijos) aplanar(hijo, profundidad + 1, acc)
}

export function AlmacenFormDialog({
  open,
  onOpenChange,
  almacen,
}: AlmacenFormDialogProps) {
  const esEdicion = almacen !== null
  const crear = useCrearAlmacen()
  const actualizar = useActualizarAlmacen()
  const guardando = crear.isPending || actualizar.isPending

  const { data: raices = [] } = useArbolUnidades(true)
  const [busquedaUnidad, setBusquedaUnidad] = useState("")

  const { control, handleSubmit, reset } = useForm<AlmacenFormValues>({
    resolver: zodResolver(almacenSchema),
    defaultValues: VALORES_INICIALES,
  })

  // El dialogo se monta una sola vez: hay que recargar el formulario cada vez
  // que se abre, si no queda con los datos del almacen editado anteriormente.
  useEffect(() => {
    if (!open) return
    reset(
      almacen
        ? {
            nombre: almacen.nombre,
            activo: almacen.activo,
            unidadIds: almacen.unidades.map((u) => u.id),
          }
        : VALORES_INICIALES
    )
  }, [open, almacen, reset])

  // Limpia el buscador al cerrar (todos los caminos pasan por aca).
  function cambiarApertura(abierto: boolean) {
    if (!abierto) setBusquedaUnidad("")
    onOpenChange(abierto)
  }

  // Árbol filtrado por búsqueda (conserva ancestros de las coincidencias),
  // agrupado por grupo (MOF, OTROS...) y aplanado con indentación.
  const porGrupo = useMemo(() => {
    const filtrado = filtrarArbol(raices, busquedaUnidad, false)
    const mapa = new Map<string, FilaUnidad[]>()
    for (const raiz of filtrado) {
      const grupo = raiz.grupo ?? "SIN GRUPO"
      const filas = mapa.get(grupo) ?? []
      aplanar(raiz, 0, filas)
      mapa.set(grupo, filas)
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [raices, busquedaUnidad])

  const hayCoincidencias = porGrupo.length > 0

  async function onSubmit(values: AlmacenFormValues) {
    try {
      if (esEdicion) {
        await actualizar.mutateAsync({ id: almacen.id, ...values })
      } else {
        await crear.mutateAsync(values)
      }
      cambiarApertura(false)
    } catch {
      // El toast de error lo emite la mutacion (ej. nombre duplicado); el
      // dialogo se queda abierto para corregir sin reescribir todo.
    }
  }

  return (
    <Dialog open={open} onOpenChange={cambiarApertura}>
      {/* Columna flex acotada a la altura de pantalla: solo la lista de unidades
          scrollea; el resto (nombre, activo, footer) queda fijo. */}
      <DialogContent className="flex max-h-[88svh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? "Editar almacén" : "Nuevo almacén"}
          </DialogTitle>
          <DialogDescription>
            Cada almacén maneja su propio stock, sus correlativos y qué unidades
            muestra al registrar un ingreso.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <InputField
            name="nombre"
            label="Nombre"
            control={control}
            placeholder="Oficina Departamental La Paz"
            description="No puede repetirse: el nombre es único en el sistema."
            disabled={guardando}
          />

          <Controller
            name="unidadIds"
            control={control}
            render={({ field }) => {
              const seleccionadas = field.value
              // Marca/desmarca un conjunto de ids (un nodo con su subárbol, o un grupo).
              const alternar = (ids: number[], marcar: boolean) => {
                const set = new Set(seleccionadas)
                ids.forEach((id) => (marcar ? set.add(id) : set.delete(id)))
                field.onChange([...set])
              }
              return (
                <Field className="flex min-h-0 flex-1 flex-col gap-2">
                  <FieldLabel>Unidades solicitantes que muestra</FieldLabel>
                  <p className="text-sm text-muted-foreground">
                    Estructura completa por grupo. Tildá un padre y se marcan
                    también sus hijos.{" "}
                    <span className="font-medium text-foreground">
                      {seleccionadas.length} seleccionada(s).
                    </span>
                  </p>

                  <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={busquedaUnidad}
                      onChange={(e) => setBusquedaUnidad(e.target.value)}
                      placeholder="Buscar unidad por nombre o sigla..."
                      className="pl-9"
                      disabled={guardando}
                    />
                  </div>

                  {/* Ocupa el alto restante del modal y scrollea internamente. */}
                  <div className="flex min-h-32 flex-1 flex-col gap-4 overflow-y-auto rounded-md border p-3">
                    {!hayCoincidencias && (
                      <p className="text-sm text-muted-foreground">
                        {raices.length === 0
                          ? "No hay unidades en el catálogo. Creá unidades primero."
                          : "Ninguna unidad coincide con la búsqueda."}
                      </p>
                    )}
                    {porGrupo.map(([grupo, filas]) => {
                      const ids = filas.map((f) => f.id)
                      const todas = ids.every((id) =>
                        seleccionadas.includes(id)
                      )
                      return (
                        <div key={grupo} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between border-b pb-1">
                            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              {grupo}
                            </span>
                            <button
                              type="button"
                              disabled={guardando}
                              onClick={() => alternar(ids, !todas)}
                              className="text-xs text-primary hover:underline"
                            >
                              {todas ? "Quitar todas" : "Seleccionar todas"}
                            </button>
                          </div>
                          {filas.map((f) => (
                            <label
                              key={f.id}
                              className="flex items-center gap-2 text-sm"
                              style={{
                                paddingLeft: `${f.profundidad * 1.25}rem`,
                              }}
                            >
                              <Checkbox
                                checked={seleccionadas.includes(f.id)}
                                disabled={guardando}
                                onCheckedChange={(c) =>
                                  alternar(f.subarbol, c === true)
                                }
                              />
                              <span
                                className={
                                  f.profundidad === 0
                                    ? "font-medium"
                                    : "text-muted-foreground"
                                }
                              >
                                {f.nombre}{" "}
                                <span className="text-xs text-muted-foreground">
                                  ({f.sigla})
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </Field>
              )
            }}
          />

          <CheckboxField
            name="activo"
            label="Activo"
            control={control}
            required={false}
            disabled={guardando}
            description="Los almacenes inactivos no se pueden asignar a usuarios."
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => cambiarApertura(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="size-4 animate-spin" />}
              {esEdicion ? "Guardar cambios" : "Crear almacén"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
