import { useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CalendarIcon,
  FileSpreadsheet,
  Loader2,
  TriangleAlert,
  Upload,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApiErrorMessage } from "@/lib/api"
import { aIsoLocal } from "@/lib/fechas"
import { moneda } from "@/lib/formato"
import { cn, SUPERFICIE_CAMPO } from "@/lib/utils"
import { aPayload, leerPlanilla } from "@/features/saldos-iniciales/leer-planilla"
import {
  importarSaldos,
  validarSaldos,
} from "@/features/saldos-iniciales/saldos-iniciales.api"
import type {
  FilaSaldo,
  ResultadoValidacion,
} from "@/features/saldos-iniciales/saldos-iniciales.types"

/** Igual que el backend agrupa: así una fila cae en el mismo almacén de los dos lados. */
const SIN_ALMACEN = "(SIN ALMACÉN ASIGNADO)"
const claveAlmacen = (f: FilaSaldo) =>
  (f.almacen ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase() || SIN_ALMACEN

/** Con 3.000 lotes, la lista de errores entera no ayuda a nadie: se acota. */
const MAX_ERRORES = 200

type ResumenAlmacen = ResultadoValidacion["almacenes"][number]

const estadoDe = (a: ResumenAlmacen) => {
  if (a.importados === a.lotes) return "importado" as const
  if (a.almacenId == null) return "sinAsignar" as const
  if (a.errores > 0) return "errores" as const
  return "listo" as const
}

/**
 * CARGA INICIAL de saldos del sistema anterior (solo super_admin). Recibe la
 * planilla de `tools/migracion-saldos/` ya con la correspondencia completa y la
 * importa ALMACÉN POR ALMACÉN: a medida que se termina la correspondencia de
 * uno, se importa ese, sin esperar a los demás. Un lote ya importado se salta
 * solo, así que volver a subir la misma planilla no duplica nada.
 */
export function SaldosInicialesPage() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [archivo, setArchivo] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaSaldo[] | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [fechaCorte, setFechaCorte] = useState<Date | undefined>()
  const [calendarioAbierto, setCalendarioAbierto] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [verErroresDe, setVerErroresDe] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const validacion = useMutation({
    mutationFn: validarSaldos,
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
  const importacion = useMutation({ mutationFn: importarSaldos })

  /** Valida con la fecha elegida, o con hoy mientras no haya una. */
  function validar(lista: FilaSaldo[], fecha: Date | undefined) {
    validacion.mutate({
      fechaCorte: aIsoLocal(fecha ?? new Date()),
      filas: aPayload(lista),
    })
  }

  async function elegirArchivo(file: File | undefined) {
    if (!file) return
    setLeyendo(true)
    setSeleccion(new Set())
    setVerErroresDe(null)
    validacion.reset()
    try {
      const leidas = await leerPlanilla(file)
      setArchivo(file.name)
      setFilas(leidas)
      validar(leidas, fechaCorte)
    } catch (error) {
      setArchivo(null)
      setFilas(null)
      toast.error(
        error instanceof Error ? error.message : "No se pudo leer la planilla"
      )
    } finally {
      setLeyendo(false)
      // Permite volver a elegir el MISMO archivo (corregido) y que dispare.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function elegirFecha(fecha: Date | undefined) {
    setFechaCorte(fecha)
    setCalendarioAbierto(false)
    if (filas) validar(filas, fecha)
  }

  const resultado = validacion.data
  const estadoPorIndice = useMemo(
    () => new Map((resultado?.filas ?? []).map((f) => [f.indice, f])),
    [resultado]
  )

  const aImportar = useMemo(() => {
    if (!filas) return []
    return filas.filter(
      (f, i) =>
        seleccion.has(claveAlmacen(f)) && !estadoPorIndice.has(i)
    )
  }, [filas, seleccion, estadoPorIndice])
  const valorAImportar = aImportar.reduce(
    (s, f) => s + f.cantidad * f.precioUnitario,
    0
  )

  const errores = useMemo(() => {
    if (!filas || !resultado) return []
    return resultado.filas
      .filter((f) => f.estado === "error")
      .map((f) => ({ ...f, fila: filas[f.indice] }))
      .filter((f) => !verErroresDe || claveAlmacen(f.fila) === verErroresDe)
  }, [filas, resultado, verErroresDe])

  function alternar(almacen: string) {
    setSeleccion((previa) => {
      const nueva = new Set(previa)
      if (nueva.has(almacen)) nueva.delete(almacen)
      else nueva.add(almacen)
      return nueva
    })
  }

  async function confirmarImportacion() {
    if (!fechaCorte || aImportar.length === 0 || !filas) return
    try {
      const r = await importacion.mutateAsync({
        fechaCorte: aIsoLocal(fechaCorte),
        filas: aPayload(aImportar),
      })
      toast.success(
        `Importados ${r.lotes} lotes en ${r.documentos} documentos de saldo inicial (gestión ${r.gestion})`
      )
      for (const clave of ["stock", "kardex", "egresos", "ingresos"]) {
        void queryClient.invalidateQueries({ queryKey: [clave] })
      }
      setSeleccion(new Set())
      validar(filas, fechaCorte)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setConfirmando(false)
    }
  }

  const fechaTexto = fechaCorte?.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Saldos iniciales
        </h1>
        <p className="text-sm text-muted-foreground">
          Carga del stock que viene del sistema anterior, a partir de la
          planilla de migración con la correspondencia de almacenes, fuentes e
          ítems completa. Se importa almacén por almacén; un lote ya importado
          no se vuelve a cargar.
        </p>
      </div>

      {/* Paso 1: planilla y fecha de corte */}
      <div className="flex flex-col gap-4 rounded-md border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-sm font-medium">Planilla de migración</span>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={leyendo || validacion.isPending}
            >
              {leyendo ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              {archivo ? "Cambiar planilla" : "Elegir planilla (.xlsx)"}
            </Button>
            {archivo && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileSpreadsheet className="size-4" />
                {archivo} · {filas?.length ?? 0} lotes
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => void elegirArchivo(e.target.files?.[0])}
          />
        </div>

        <div className="flex flex-col gap-2 sm:w-64">
          <span className="text-sm font-medium">
            Saldos al cierre del día<span className="ml-1 text-red-500">*</span>
          </span>
          <Popover open={calendarioAbierto} onOpenChange={setCalendarioAbierto}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  SUPERFICIE_CAMPO,
                  "justify-between font-normal",
                  !fechaCorte && "text-muted-foreground"
                )}
              >
                {fechaTexto ?? "Elegí la fecha de corte"}
                <CalendarIcon className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={fechaCorte}
                onSelect={elegirFecha}
                disabled={{ after: new Date() }}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {validacion.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Revisando la planilla…
        </div>
      )}

      {resultado?.errorFecha && (
        <p className="text-sm text-destructive">{resultado.errorFecha}</p>
      )}

      {/* Paso 2: qué almacenes están listos */}
      {resultado && filas && (
        <div className="rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Almacén nuevo</TableHead>
                <TableHead className="text-right">Lotes</TableHead>
                <TableHead className="text-right">Valor Bs</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.almacenes.map((a) => {
                const estado = estadoDe(a)
                const listo = estado === "listo"
                return (
                  <TableRow key={a.almacen}>
                    <TableCell>
                      <Checkbox
                        checked={seleccion.has(a.almacen)}
                        onCheckedChange={() => alternar(a.almacen)}
                        disabled={!listo}
                        aria-label={`Importar ${a.almacen}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium whitespace-normal">
                      {a.almacen}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.lotes}
                      {a.importados > 0 && a.importados < a.lotes && (
                        <span className="block text-xs text-muted-foreground">
                          {a.importados} ya importados
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneda(a.valor)}
                    </TableCell>
                    <TableCell>
                      {estado === "listo" && <Badge>Listo para importar</Badge>}
                      {estado === "importado" && (
                        <Badge variant="secondary">Importado</Badge>
                      )}
                      {(estado === "errores" || estado === "sinAsignar") && (
                        <button
                          type="button"
                          className="text-left text-sm text-destructive underline-offset-2 hover:underline"
                          onClick={() =>
                            setVerErroresDe(
                              verErroresDe === a.almacen ? null : a.almacen
                            )
                          }
                        >
                          {estado === "sinAsignar"
                            ? `${a.lotes} lotes sin almacén asignado`
                            : `${a.errores} ${a.errores === 1 ? "lote con error" : "lotes con error"}`}
                          {verErroresDe === a.almacen ? " · ver todos" : " · ver"}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {aImportar.length > 0
                ? `${aImportar.length} lotes por Bs ${moneda(valorAImportar)} seleccionados.`
                : "Marcá los almacenes listos que quieras importar."}
              {!fechaCorte && " Falta elegir la fecha de corte."}
            </p>
            <Button
              type="button"
              disabled={
                aImportar.length === 0 ||
                !fechaCorte ||
                !!resultado.errorFecha ||
                validacion.isPending
              }
              onClick={() => setConfirmando(true)}
            >
              Importar saldos
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3: qué falta corregir en la planilla */}
      {errores.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <TriangleAlert className="size-4 text-destructive" />
            Lotes que no se pueden importar
            {verErroresDe ? ` · ${verErroresDe}` : ""} ({errores.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Se corrigen en la planilla (hojas ALMACENES, FUENTES e ÍTEMS) y se
            vuelve a subir. Los códigos de ítem tienen que existir en el
            catálogo nuevo.
          </p>
          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote viejo</TableHead>
                  <TableHead>Almacén anterior</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Qué falta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errores.slice(0, MAX_ERRORES).map((e) => (
                  <TableRow key={e.indice}>
                    <TableCell className="tabular-nums">
                      {e.fila.loteAnteriorId}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {e.fila.almacenAnterior}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {e.fila.descripcionAnterior}
                    </TableCell>
                    <TableCell className="whitespace-normal text-destructive">
                      {e.mensajes.join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {errores.length > MAX_ERRORES && (
              <p className="border-t p-3 text-sm text-muted-foreground">
                Se muestran los primeros {MAX_ERRORES} de {errores.length}.
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Importar los saldos iniciales?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <p>
                  Se van a cargar <strong>{aImportar.length} lotes</strong> por{" "}
                  <strong>Bs {moneda(valorAImportar)}</strong> en{" "}
                  {seleccion.size === 1 ? "el almacén" : "los almacenes"}{" "}
                  {[...seleccion].join(", ")}, como saldos al cierre del{" "}
                  <strong>{fechaTexto}</strong>.
                </p>
                <p>
                  Quedan como stock disponible de inmediato. No se editan: si un
                  lote quedó mal (por ejemplo, con otro ítem), se anula ese
                  documento y se vuelve a importar el lote corregido.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importacion.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Sin esto el diálogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarImportacion()
              }}
              disabled={importacion.isPending}
            >
              {importacion.isPending && <Loader2 className="animate-spin" />}
              Importar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
