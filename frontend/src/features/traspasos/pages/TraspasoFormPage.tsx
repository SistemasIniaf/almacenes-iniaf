import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Loader2,
  Search,
  TriangleAlert,
} from "lucide-react"

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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useNotaTraspaso } from "@/features/traspasos/hooks/useNotaTraspaso"
import {
  useCrearTraspaso,
  useLotesDeAlmacen,
  useTodosLosAlmacenes,
  useTraspaso,
} from "@/features/traspasos/hooks/useTraspasos"
import {
  descripcionLote,
  documentoLote,
  etiquetaNumero,
} from "@/features/traspasos/traspasos.types"
import { getApiErrorMessage } from "@/lib/api"
import { cantidad, moneda, precio } from "@/lib/formato"
import { cn } from "@/lib/utils"

import type {
  LoteDisponible,
  Traspaso,
} from "@/features/traspasos/traspasos.types"

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

/** Sin acentos ni mayúsculas, para el filtro local de la lista de lotes. */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/**
 * `/traspasos/nuevo` arma el traspaso; `/traspasos/:id` muestra uno ya
 * registrado (no se editan ni se anulan: versión mínima, 2026-10-29).
 */
export function TraspasoFormPage() {
  const { id } = useParams()
  return id ? <FichaTraspaso id={Number(id)} /> : <NuevoTraspaso />
}

function Encabezado({
  titulo,
  children,
}: {
  titulo: string
  children?: React.ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 -ml-2"
          onClick={() => navigate("/traspasos")}
        >
          <ArrowLeft className="size-4" />
          Volver
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

function NuevoTraspaso() {
  const navigate = useNavigate()
  const { data: almacenes = [], isPending: cargandoAlmacenes } =
    useTodosLosAlmacenes()

  const [origenId, setOrigenId] = useState("")
  const [destinoId, setDestinoId] = useState("")
  const [motivo, setMotivo] = useState("")
  const [filtro, setFiltro] = useState("")
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  /** Solo lo que se cambió a mano; lo demás vale TODO el disponible. */
  const [cantidades, setCantidades] = useState<Record<number, string>>({})
  const [confirmando, setConfirmando] = useState(false)

  const lotesQuery = useLotesDeAlmacen(origenId ? Number(origenId) : undefined)
  const lotes = useMemo(() => lotesQuery.data ?? [], [lotesQuery.data])
  const crear = useCrearTraspaso()

  const aTraspasar = (lote: LoteDisponible) =>
    cantidades[lote.id] ?? String(lote.disponible)

  /** Error de la fila elegida, o null. */
  const errorDe = (lote: LoteDisponible): string | null => {
    const valor = Number(aTraspasar(lote))
    if (!Number.isFinite(valor) || valor <= 0) return "Tiene que ser mayor a 0"
    if (valor > lote.disponible)
      return `No puede superar el disponible (${cantidad(lote.disponible)})`
    return null
  }

  const visibles = useMemo(() => {
    const termino = normalizar(filtro.trim())
    if (!termino) return lotes
    return lotes.filter((l) =>
      normalizar(
        `${l.item.codigo} ${l.item.descripcion} ${l.observacion ?? ""} ${l.ingreso.fuenteFinanciamiento?.nombre ?? ""}`
      ).includes(termino)
    )
  }, [lotes, filtro])

  const conDisponible = lotes.filter((l) => l.disponible > 0)
  const conReserva = lotes.filter((l) => l.reservado > 0)
  const elegidos = lotes.filter((l) => seleccion.has(l.id))
  const conError = elegidos.filter((l) => errorDe(l) != null)
  const valorElegido = elegidos.reduce(
    (suma, l) => suma + Number(aTraspasar(l) || 0) * Number(l.precioUnitario),
    0
  )
  const todoElegido =
    conDisponible.length > 0 && elegidos.length === conDisponible.length

  const origen = almacenes.find((a) => String(a.id) === origenId)
  const destino = almacenes.find((a) => String(a.id) === destinoId)

  function cambiarOrigen(valor: string) {
    setOrigenId(valor)
    if (valor === destinoId) setDestinoId("")
    setSeleccion(new Set())
    setCantidades({})
    setFiltro("")
  }

  function alternar(lote: LoteDisponible, marcado: boolean) {
    setSeleccion((anterior) => {
      const nueva = new Set(anterior)
      if (marcado) nueva.add(lote.id)
      else nueva.delete(lote.id)
      return nueva
    })
  }

  function elegirTodo(marcado: boolean) {
    setSeleccion(
      marcado ? new Set(conDisponible.map((l) => l.id)) : new Set<number>()
    )
    if (!marcado) setCantidades({})
  }

  const faltante = !origenId
    ? "Elegí el almacén de origen"
    : !destinoId
      ? "Elegí el almacén de destino"
      : elegidos.length === 0
        ? "Elegí al menos un lote"
        : conError.length > 0
          ? "Corregí las cantidades marcadas en rojo"
          : !motivo.trim()
            ? "Escribí el motivo del traspaso"
            : null

  function registrar() {
    crear.mutate(
      {
        almacenOrigenId: Number(origenId),
        almacenDestinoId: Number(destinoId),
        observacion: motivo.trim(),
        detalles: elegidos.map((l) => ({
          ingresoDetalleId: l.id,
          cantidad: Number(aTraspasar(l)),
        })),
      },
      {
        onSuccess: (traspaso) => navigate(`/traspasos/${traspaso.id}`),
        onSettled: () => setConfirmando(false),
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Encabezado titulo="Nuevo traspaso" />

      <div className="grid gap-4 rounded-md border bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="origen">Almacén de origen</Label>
          <Select
            value={origenId}
            onValueChange={cambiarOrigen}
            disabled={cargandoAlmacenes}
          >
            <SelectTrigger id="origen" className="w-full">
              <SelectValue placeholder="De dónde sale el material" />
            </SelectTrigger>
            <SelectContent position="popper">
              {almacenes.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.nombre}
                  {!a.activo && " (inactivo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="destino">Almacén de destino</Label>
          {/* Solo activos: material en un almacén dado de baja queda donde
              nadie lo puede sacar. El backend lo rechaza igual. */}
          <Select value={destinoId} onValueChange={setDestinoId}>
            <SelectTrigger id="destino" className="w-full">
              <SelectValue placeholder="A dónde llega" />
            </SelectTrigger>
            <SelectContent position="popper">
              {almacenes
                .filter((a) => a.activo && String(a.id) !== origenId)
                .map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="motivo">Motivo</Label>
          <Textarea
            id="motivo"
            value={motivo}
            // Mayúsculas al escribir, como todo texto libre del sistema.
            onChange={(e) => setMotivo(e.target.value.toUpperCase())}
            maxLength={300}
            rows={2}
            placeholder="EJ. CIERRE DEL ALMACÉN"
          />
        </div>
      </div>

      {origenId && (
        <section className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-lg font-semibold">
                Lotes de {origen?.nombre}
              </h2>
              <p className="text-sm text-muted-foreground">
                Marcá los lotes a traspasar. La cantidad propuesta es todo lo
                disponible; podés bajarla.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={conDisponible.length === 0}
                onClick={() => elegirTodo(!todoElegido)}
              >
                {todoElegido ? "Quitar selección" : "Elegir todo el almacén"}
              </Button>
            </div>
          </div>

          {/* Lo que no se puede llevar: un traspaso nunca toca material que
              un pedido ya tiene comprometido. Para cerrar el almacén hay que
              resolver esos pedidos primero. */}
          {conReserva.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                {conReserva.length === 1
                  ? "1 lote tiene"
                  : `${conReserva.length} lotes tienen`}{" "}
                material reservado por pedidos en curso: de esos solo se
                traspasa lo disponible. Para vaciar el almacén, entregá, rechazá
                o esperá que venzan esos pedidos y volvé a cargar esta pantalla.
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por código, descripción o fuente..."
              className="pl-9"
              aria-label="Filtrar lotes"
            />
          </div>

          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={todoElegido}
                      disabled={conDisponible.length === 0}
                      onCheckedChange={(v) => elegirTodo(v === true)}
                      aria-label="Elegir todos"
                    />
                  </TableHead>
                  <TableHead>Ítem</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">P. unit.</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="w-32 text-right">A traspasar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotesQuery.isPending &&
                  Array.from({ length: 3 }).map((_, f) => (
                    <TableRow key={f}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {lotesQuery.isError && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-destructive"
                    >
                      {getApiErrorMessage(lotesQuery.error)}
                    </TableCell>
                  </TableRow>
                )}
                {lotesQuery.isSuccess && visibles.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      {lotes.length === 0
                        ? "Este almacén no tiene material con saldo."
                        : "Ningún lote coincide con el filtro."}
                    </TableCell>
                  </TableRow>
                )}
                {visibles.map((lote) => {
                  const marcado = seleccion.has(lote.id)
                  const bloqueado = lote.disponible <= 0
                  const error = marcado ? errorDe(lote) : null
                  return (
                    <TableRow
                      key={lote.id}
                      className={cn(bloqueado && "opacity-60")}
                    >
                      <TableCell className="align-top">
                        <Checkbox
                          checked={marcado}
                          disabled={bloqueado}
                          onCheckedChange={(v) => alternar(lote, v === true)}
                          aria-label={`Elegir ${lote.item.descripcion}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">
                          {descripcionLote(lote)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {lote.item.codigo} · {documentoLote(lote.ingreso)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-normal text-muted-foreground">
                        {lote.ingreso.fuenteFinanciamiento?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {precio(lote.precioUnitario)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {cantidad(lote.saldoCantidad)}{" "}
                        <span className="text-xs text-muted-foreground">
                          {lote.item.unidadMedida}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          lote.reservado > 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-muted-foreground"
                        )}
                      >
                        {lote.reservado > 0 ? cantidad(lote.reservado) : "—"}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {marcado ? (
                          <div className="flex flex-col items-end gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={lote.disponible}
                              step="any"
                              value={aTraspasar(lote)}
                              onChange={(e) =>
                                setCantidades((c) => ({
                                  ...c,
                                  [lote.id]: e.target.value,
                                }))
                              }
                              aria-invalid={error != null}
                              className="h-8 w-28 text-right"
                            />
                            {error && (
                              <span className="text-xs whitespace-normal text-destructive">
                                {error}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {bloqueado
                              ? "Todo reservado"
                              : `disp. ${cantidad(lote.disponible)}`}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {/* El pie con el resumen y el botón, debajo de lo que se decide,
                como Guardar en los otros formularios. */}
            <div className="flex flex-col items-stretch justify-between gap-3 border-t p-4 sm:flex-row sm:items-center">
              <div className="text-sm">
                <span className="font-medium">
                  {elegidos.length} de {lotes.length} lotes
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · Bs {moneda(valorElegido)}
                </span>
                {faltante && (
                  <div className="text-xs text-muted-foreground">
                    {faltante}
                  </div>
                )}
              </div>
              <Button
                disabled={faltante != null || crear.isPending}
                onClick={() => setConfirmando(true)}
              >
                Registrar traspaso
              </Button>
            </div>
          </div>
        </section>
      )}

      <AlertDialog
        open={confirmando}
        onOpenChange={(abierto) => !crear.isPending && setConfirmando(abierto)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar el traspaso?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-1 font-medium text-foreground">
                  {origen?.nombre}
                  <ArrowRight className="size-4" />
                  {destino?.nombre}
                </div>
                <div>
                  Se traspasan{" "}
                  <strong>
                    {elegidos.length} {elegidos.length === 1 ? "lote" : "lotes"}
                  </strong>{" "}
                  por <strong>Bs {moneda(valorElegido)}</strong>. El saldo baja
                  ahora mismo en el origen y aparece en el destino, con el mismo
                  precio y la misma fuente.
                </div>
                <div>No se puede deshacer.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={crear.isPending}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={crear.isPending}
              onClick={(e) => {
                e.preventDefault()
                registrar()
              }}
            >
              {crear.isPending && <Loader2 className="size-4 animate-spin" />}
              Traspasar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

function FichaTraspaso({ id }: { id: number }) {
  const { data: traspaso, isPending, isError, error } = useTraspaso(id)
  const { abrirNota, generandoId } = useNotaTraspaso()

  if (isPending) return <Skeleton className="h-64 w-full" />
  if (isError || !traspaso) {
    return (
      <div className="flex flex-col gap-4">
        <Encabezado titulo="Traspaso" />
        <p className="text-sm text-destructive">
          {getApiErrorMessage(error, "No se pudo cargar el traspaso.")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Encabezado titulo={`Traspaso ${etiquetaNumero(traspaso)}`}>
        <Button
          variant="outline"
          disabled={generandoId === traspaso.id}
          onClick={() => void abrirNota(traspaso)}
        >
          {generandoId === traspaso.id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          Ver PDF
        </Button>
      </Encabezado>

      <DatosTraspaso traspaso={traspaso} />
      <LineasTraspaso traspaso={traspaso} />
    </div>
  )
}

function Dato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="font-medium">{valor}</div>
    </div>
  )
}

function DatosTraspaso({ traspaso }: { traspaso: Traspaso }) {
  return (
    <div className="grid gap-4 rounded-md border bg-card p-4 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <Dato rotulo="Almacén de origen" valor={traspaso.almacenOrigen.nombre} />
      <Dato
        rotulo="Almacén de destino"
        valor={traspaso.almacenDestino.nombre}
      />
      <Dato rotulo="Fecha" valor={fecha(traspaso.fecha)} />
      <Dato rotulo="Registrado por" valor={traspaso.registradoPor.nombre} />
      <div className="sm:col-span-2 lg:col-span-4">
        <Dato rotulo="Motivo" valor={traspaso.observacion} />
      </div>
    </div>
  )
}

function LineasTraspaso({ traspaso }: { traspaso: Traspaso }) {
  const total = traspaso.detalles.reduce(
    (s, d) => s + Number(d.cantidad) * Number(d.loteOrigen.precioUnitario),
    0
  )
  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h2 className="text-lg font-semibold">
        Lotes traspasados{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({traspaso.detalles.length})
        </span>
      </h2>
      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">Nº</TableHead>
              <TableHead>Ítem</TableHead>
              <TableHead>Fuente</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">P. unit.</TableHead>
              <TableHead className="text-right">Total (Bs)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {traspaso.detalles.map((d, i) => (
              <TableRow key={d.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <div className="font-medium">
                    {descripcionLote(d.loteOrigen)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.loteOrigen.item.codigo} ·{" "}
                    {documentoLote(d.loteOrigen.ingreso)}
                  </div>
                </TableCell>
                <TableCell className="text-xs whitespace-normal text-muted-foreground">
                  {d.loteOrigen.ingreso.fuenteFinanciamiento?.nombre ?? "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {cantidad(d.cantidad)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {d.loteOrigen.item.unidadMedida}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {precio(d.loteOrigen.precioUnitario)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {moneda(
                    Number(d.cantidad) * Number(d.loteOrigen.precioUnitario)
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={5} className="text-right font-semibold">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {moneda(total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
