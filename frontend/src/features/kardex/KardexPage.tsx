import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { Loader2, Printer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { ComboboxField } from "@/components/form/ComboboxField"
import { DateRangeFilter } from "@/components/data/DateRangeFilter"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useFuentesActivas } from "@/features/fuentes-financiamiento/useFuentesFinanciamiento"
import { useKardex } from "@/features/kardex/useKardex"
import { useReporteKardex } from "@/features/kardex/useReporteKardex"
import {
  ITEMS_POR_BUSQUEDA,
  useBuscarItems,
} from "@/features/items/useBuscarItems"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { aIsoLocal } from "@/lib/fechas"
import { cantidad, precio } from "@/lib/formato"
import { cn } from "@/lib/utils"

import type { DateRange } from "react-day-picker"
import type { MovimientoKardex } from "@/features/kardex/kardex.types"

const TODAS = "todas"

/** Cantidad del libro; `null` es «no aplica» en esa columna (entrada o salida). */
const numero = (n: number | string | null) => (n == null ? "—" : cantidad(n))

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

/**
 * Color del badge de cada movimiento. La SALIDA va en ámbar con clases
 * explícitas —igual que los badges de rol— y no con el gris de `secondary`: la
 * columna se lee de un vistazo y una salida no puede quedar tan neutra que se
 * confunda con una entrada.
 */
const MOVIMIENTO_BADGE: Record<
  MovimientoKardex["tipo"],
  { variant: "default" | "outline" | "destructive"; className?: string }
> = {
  ENTRADA: { variant: "default" },
  SALIDA: {
    variant: "outline",
    className:
      "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  REVERSION: { variant: "destructive" },
}

/** Los combos con buscador (ítem y fuente) usan react-hook-form. */
interface FormKardex {
  itemId: string
  fuenteId: string
}

export function KardexPage() {
  const { user } = useAuth()
  const esResponsable = user?.rol === "responsable_almacen"
  // El ítem y el almacén pueden venir de la pantalla de stock.
  const [params] = useSearchParams()

  const { control, watch } = useForm<FormKardex>({
    defaultValues: { itemId: params.get("item") ?? "", fuenteId: TODAS },
  })
  const itemId = watch("itemId")
  const fuenteId = watch("fuenteId")

  const [almacenId, setAlmacenId] = useState(params.get("almacen") ?? "")
  const [gestion, setGestion] = useState(String(new Date().getFullYear()))
  const [rango, setRango] = useState<DateRange | undefined>()

  /**
   * Los filtros del libro, en un solo objeto que usan la pantalla y el reporte.
   * El rango acota qué movimientos se listan y mueve el saldo de apertura — un
   * extracto de marzo abre con el saldo al 1/3.
   *
   * **El ítem va incluido**: si hay uno elegido, el reporte sale de ESE ítem, no
   * del almacén entero. El papel tiene que decir lo mismo que la pantalla; para
   * el reporte completo se deja el selector vacío, que es lo que lo vuelve
   * opcional en el backend.
   */
  const filtros = {
    itemId: itemId ? Number(itemId) : undefined,
    almacenId: almacenId ? Number(almacenId) : undefined,
    gestion: Number(gestion),
    fuenteFinanciamientoId: fuenteId === TODAS ? undefined : Number(fuenteId),
    // En hora local: pasarlo por UTC correría el día en un huso negativo.
    desde: rango?.from ? aIsoLocal(rango.from) : undefined,
    hasta: rango?.to ? aIsoLocal(rango.to) : undefined,
  }

  const { data: almacenes = [] } = useAlmacenesActivos()
  const { data: fuentes = [] } = useFuentesActivas()
  const { abrirReporte, generando: generandoReporte } = useReporteKardex()

  // Buscador de ítems contra el servidor (el catálogo no entra en el navegador).
  const [busqueda, setBusqueda] = useState("")
  const termino = useDebouncedValue(busqueda, 300)
  const {
    data: itemsPagina,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useBuscarItems(termino)
  const resultados = itemsPagina?.pages.flatMap((p) => p.data) ?? []
  const totalItems = itemsPagina?.pages[0]?.meta.total ?? 0

  // El saldo corriente es de un ítem EN UN ALMACÉN: sin las dos cosas no hay
  // consulta que hacer. El responsable no elige almacén, usa el suyo. Sin este
  // corte, entrar desde stock sin almacén filtrado dispara una petición que el
  // backend rechaza y el usuario aterriza en un error en vez de en un aviso.
  const listo = Boolean(itemId) && (esResponsable || Boolean(almacenId))

  const { data, isPending, isError, error } = useKardex(
    listo ? { ...filtros, itemId: Number(itemId) } : null
  )

  // El ítem elegido tiene que seguir con etiqueta aunque la búsqueda cambie.
  const elegido =
    resultados.find((i) => String(i.id) === itemId) ??
    (data ? data.item : undefined)
  const opciones = [
    ...(elegido && !resultados.some((i) => String(i.id) === itemId)
      ? [
          {
            value: String(elegido.id),
            label: `${elegido.codigo} — ${elegido.descripcion}`,
            busqueda: elegido.codigo,
          },
        ]
      : []),
    ...resultados.map((i) => ({
      value: String(i.id),
      label: `${i.codigo} — ${i.descripcion}`,
      busqueda: i.codigo,
    })),
  ]

  // El sistema anterior obliga a elegir una fuente; acá "todas" es lo normal y
  // filtrar, la excepción — por eso encabeza la lista.
  const opcionesFuente = [
    { value: TODAS, label: "Todas las fuentes" },
    ...fuentes.map((fuente) => ({
      value: String(fuente.id),
      label: fuente.nombre,
    })),
  ]

  const gestiones = Array.from({ length: 6 }, (_, i) =>
    String(new Date().getFullYear() - i)
  )

  const columnas = 8

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kardex</h1>
          <p className="text-sm text-muted-foreground">
            Libro de movimientos de un ítem en un almacén, con el saldo
            corriendo. El reporte sale con los mismos filtros; si no elegís
            ítem, trae <strong>todos</strong> los del almacén, un bloque por
            ítem y fuente.
          </p>
        </div>

        {/* No exige ítem elegido —sin él sale el almacén entero— pero sí lo
            respeta cuando lo hay. El almacén es lo único obligatorio, y el
            responsable ya lo tiene resuelto. */}
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={generandoReporte || (!esResponsable && !almacenId)}
          onClick={() => void abrirReporte(filtros)}
        >
          {generandoReporte ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Printer className="size-4" />
          )}
          Reporte
        </Button>
      </div>

      {/*
        Orden de los filtros: gestión → almacén → fuente → fechas → ítem. Va de
        lo más general a lo más específico, que es como se acota una consulta al
        libro: primero el período y el almacén, después el financiador, el rango
        fino y recién al final el ítem concreto. El ítem queda último y con el
        ancho que sobra porque es el que más texto muestra (código + descripción);
        para quien elige almacén, se pasa a la segunda fila entero.
      */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium">Gestión</label>
          <Select value={gestion} onValueChange={setGestion}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {gestiones.map((anio) => (
                <SelectItem key={anio} value={anio}>
                  {anio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* El responsable no elige almacén: el kardex es del suyo. */}
        {!esResponsable && (
          <div className="lg:col-span-3">
            <label className="mb-2 block text-sm font-medium">Almacén</label>
            <Select value={almacenId} onValueChange={setAlmacenId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elegí el almacén" />
              </SelectTrigger>
              <SelectContent position="popper">
                {almacenes.map((almacen) => (
                  <SelectItem key={almacen.id} value={String(almacen.id)}>
                    {almacen.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="lg:col-span-3">
          <ComboboxField
            name="fuenteId"
            label="Fuente"
            control={control}
            required={false}
            options={opcionesFuente}
            buscarPlaceholder="Buscar fuente..."
            vacio="Ninguna fuente coincide."
          />
        </div>

        {/* Acota el libro dentro de la gestión. Mueve además el saldo de
            apertura: pedir marzo abre con el saldo al 1/3, no con el de
            enero — si no, el saldo corriente no cerraría. */}
        <div className="lg:col-span-4">
          <label className="mb-2 block text-sm font-medium">Fechas</label>
          <DateRangeFilter
            value={rango}
            onChange={setRango}
            placeholder="Toda la gestión"
            className="w-full"
            aria-label="Filtrar por rango de fechas"
          />
        </div>

        <div className={esResponsable ? "lg:col-span-3" : "lg:col-span-12"}>
          <ComboboxField
            name="itemId"
            label="Ítem"
            control={control}
            options={opciones}
            placeholder="Elegí un ítem"
            vacio="Ningún ítem coincide."
            buscarPlaceholder="Buscar por código o descripción..."
            search={busqueda}
            onSearchChange={setBusqueda}
            onEndReached={() => {
              if (hasNextPage && !isFetching && !isFetchingNextPage)
                void fetchNextPage()
            }}
            loading={isFetching && !isFetchingNextPage}
            footer={
              totalItems > resultados.length
                ? `Viendo ${resultados.length} de ${totalItems.toLocaleString("es-BO")} ítems. Seguí bajando para cargar más.`
                : totalItems > ITEMS_POR_BUSQUEDA
                  ? `${totalItems.toLocaleString("es-BO")} ítems.`
                  : null
            }
          />
        </div>
      </div>

      {!listo && (
        <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
          {!itemId
            ? "Elegí un ítem para ver su kardex."
            : "Elegí el almacén: el saldo corre por almacén."}
        </div>
      )}

      {listo && (
        <>
          {data && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <span className="font-medium">
                {data.item.codigo} · {data.item.descripcion}
              </span>
              <span className="text-muted-foreground">
                {data.item.partida.codigo} · {data.item.partida.denominacion}
              </span>
              <span className="text-muted-foreground">
                {data.almacen.nombre}
              </span>
              <span className="ml-auto">
                Saldo final:{" "}
                <span className="font-semibold tabular-nums">
                  {numero(data.saldoFinal)} {data.item.unidadMedida}
                </span>
              </span>
            </div>
          )}

          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead className="text-right">P. unitario</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Salida</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending &&
                  Array.from({ length: 4 }).map((_, fila) => (
                    <TableRow key={fila}>
                      {Array.from({ length: columnas }).map((__, celda) => (
                        <TableCell key={celda}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {isError && (
                  <TableRow>
                    <TableCell
                      colSpan={columnas}
                      className="py-8 text-center text-sm text-destructive"
                    >
                      {getApiErrorMessage(
                        error,
                        "No se pudo cargar el kardex."
                      )}
                    </TableCell>
                  </TableRow>
                )}

                {data && (
                  <>
                    {/* Lo que venía de gestiones anteriores: sin esta línea, el
                        saldo de la primera fila parece salir de la nada. */}
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={columnas - 1}
                        className="text-xs text-muted-foreground italic"
                      >
                        Saldo al cierre de {data.gestion - 1}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">
                        {numero(data.saldoInicial)}
                      </TableCell>
                    </TableRow>

                    {data.movimientos.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={columnas}
                          className="py-8 text-center text-sm text-muted-foreground"
                        >
                          Sin movimientos en {data.gestion}.
                        </TableCell>
                      </TableRow>
                    )}

                    {data.movimientos.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">
                          {fecha(m.fecha)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={MOVIMIENTO_BADGE[m.tipo].variant}
                            className={cn(
                              "font-normal",
                              MOVIMIENTO_BADGE[m.tipo].className
                            )}
                          >
                            {m.tipo}
                          </Badge>
                          {m.motivo && (
                            <span
                              className="ml-2 text-xs text-muted-foreground"
                              title={m.motivo}
                            >
                              {m.motivo}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {m.documento ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.fuente?.nombre ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {precio(m.precioUnitario)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {numero(m.entrada)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {numero(m.salida)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {numero(m.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
