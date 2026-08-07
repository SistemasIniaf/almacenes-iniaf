import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  TrendingUp,
  FileSpreadsheet,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  FileText,
  Search,
  Send,
  Trash2,
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
import { Input } from "@/components/ui/input"
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
import { BadgeEstado } from "@/components/data/BadgeEstado"
import { DataPagination } from "@/components/data/DataPagination"
import { DateRangeFilter } from "@/components/data/DateRangeFilter"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { tienePermiso } from "@/features/auth/lib/permisos"
import { EnviarDialog } from "@/features/egresos/components/EnviarDialog"
import { HistorialSheet } from "@/features/egresos/components/HistorialSheet"
import {
  useDescartarEgreso,
  useEgresos,
} from "@/features/egresos/hooks/useEgresos"
import { useReporteEgresos } from "@/features/egresos/hooks/useReporteEgresos"
import { useSolicitudPdf } from "@/features/egresos/hooks/useSolicitudPdf"
import { IconAction } from "@/components/data/IconAction"
import { MACIZO, TONO_ACCION } from "@/components/data/tonos-accion"
import {
  ESTADO_DETALLE,
  ESTADOS_CON_MOVIMIENTO,
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
} from "@/features/egresos/egresos.types"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getApiErrorMessage } from "@/lib/api"
import { aIsoLocal } from "@/lib/fechas"
import { usePagination } from "@/hooks/use-pagination"

import type { DateRange } from "react-day-picker"
import type { FiltrosEgresos } from "@/features/egresos/hooks/useReporteEgresos"
import type {
  EgresoListItem,
  EstadoEgreso,
} from "@/features/egresos/egresos.types"

/**
 * `MOVIMIENTO` es un valor compuesto del selector: los estados que movieron
 * stock (entregados y anulados). No es un estado de la BD — se traduce a la
 * lista `ESTADOS_CON_MOVIMIENTO` al armar los filtros.
 */
type FiltroEstado = EstadoEgreso | "todos" | "movimiento"

const TODOS = "todos"
const MOVIMIENTO = "movimiento"

const ESTADOS: EstadoEgreso[] = [
  "BORRADOR",
  "PENDIENTE_APROBADOR",
  "PENDIENTE_RESPONSABLE_ALMACEN",
  "ENTREGADO",
  "ANULADO",
]

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-BO") : "—"

export function EgresosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const puedeCrear = tienePermiso(user, "egresosCrear")
  const puedeReportar = tienePermiso(user, "reportes")
  const { abrirSolicitud, generandoId, puedeImprimir } = useSolicitudPdf()

  // Quien decide algo en el circuito arranca en SU bandeja: lo que espera su
  // firma. El resto ve todo lo que le toca por alcance.
  const tieneBandeja =
    user?.rol === "aprobador" || user?.rol === "responsable_almacen"

  // Las tarjetas de la home enlazan acá con el estado ya elegido (?estado=…).
  // Es solo el valor INICIAL: a partir de ahí manda el selector, que no escribe
  // en la URL. Si viene un estado, la bandeja arranca apagada — combinarlos daría
  // cero resultados en cuanto el estado pedido no sea el de la bandeja del rol.
  const estadoUrl = params.get("estado") as EstadoEgreso | null
  const estadoInicial: FiltroEstado =
    estadoUrl && ESTADOS.includes(estadoUrl) ? estadoUrl : TODOS

  const descartar = useDescartarEgreso()
  // Enviar y descartar piden confirmación: los dos son sin vuelta atrás.
  const [aEnviar, setAEnviar] = useState<EgresoListItem | null>(null)
  const [aDescartar, setADescartar] = useState<EgresoListItem | null>(null)
  const [historialDe, setHistorialDe] = useState<number | null>(null)

  // El ALMACÉN solo se muestra a quien ve más de uno, igual que en ingresos y
  // en stock. Al responsable no le aporta: todas sus filas son del suyo.
  // (Hasta el 2026-08-03 acá iba la UNIDAD; el encargado pidió el almacén, que
  // es de dónde sale el material.)
  const veVariosAlmacenes =
    user?.rol === "super_admin" ||
    user?.rol === "admin" ||
    user?.rol === "observador_almacen"

  const { page, pageSize, setPage, setPageSize, resetPage } = usePagination()
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState<FiltroEstado>(estadoInicial)
  const [soloBandeja, setSoloBandeja] = useState(
    tieneBandeja && estadoInicial === TODOS
  )
  const [almacenId, setAlmacenId] = useState<string>(TODOS)
  const [rango, setRango] = useState<DateRange | undefined>()
  const busquedaDiferida = useDebouncedValue(busqueda)

  const { abrirReporte, generando: generandoReporte } = useReporteEgresos()

  // Solo hace falta para el selector, así que se pide únicamente a quien lo ve.
  const { data: almacenes = [] } = useAlmacenesActivos({
    enabled: veVariosAlmacenes,
  })

  /**
   * Los filtros, en un solo objeto: el listado le agrega la paginación y el
   * reporte lo usa tal cual. Así el papel sale con lo mismo que está en
   * pantalla, sin poder desalinearse.
   */
  const filtros: FiltrosEgresos = {
    q: busquedaDiferida || undefined,
    estado:
      estado === TODOS
        ? undefined
        : estado === MOVIMIENTO
          ? ESTADOS_CON_MOVIMIENTO
          : estado,
    pendientesMios: soloBandeja || undefined,
    almacenId: almacenId === TODOS ? undefined : Number(almacenId),
    // En hora local: el rango se eligió en un calendario, y pasarlo por UTC
    // correría el día para quien está en un huso negativo (Bolivia, UTC-4).
    desde: rango?.from ? aIsoLocal(rango.from) : undefined,
    hasta: rango?.to ? aIsoLocal(rango.to) : undefined,
  }

  const { data, isPending, isError, error } = useEgresos({
    ...filtros,
    page,
    pageSize,
  })

  /** El almacén del encabezado del reporte: `null` = todos (nacional). */
  const almacenReporte =
    almacenId === TODOS
      ? null
      : (almacenes.find((a) => String(a.id) === almacenId)?.nombre ?? null)

  function cambiarFiltro(accion: () => void) {
    accion()
    resetPage()
  }

  const egresos = data?.data ?? []
  // El solicitador solo ve SUS pedidos (lo aplica el alcance del backend), así
  // que la columna repetiría su nombre en todas las filas. Para el resto sí
  // distingue de quién es cada pedido.
  const veVariosSolicitantes = user?.rol !== "solicitador"

  /**
   * Editar, enviar y descartar solo valen sobre un borrador PROPIO — es lo mismo
   * que exige el backend (`exigirSolicitante` + `exigirEstado`). Se compara por
   * id de solicitante y no por rol: un admin ve borradores ajenos en el listado y
   * tampoco puede tocarlos.
   */
  const puedeGestionar = (egreso: EgresoListItem) =>
    egreso.estado === "BORRADOR" && egreso.solicitante.id === user?.id

  // Fijas: Nº, Fecha, Justificación, Ítems, Estado y Acciones — esta última
  // siempre está, porque «Ver historial» lo puede usar cualquier rol.
  const columnas =
    6 + (veVariosAlmacenes ? 1 : 0) + (veVariosSolicitantes ? 1 : 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Egresos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos de material: los arma el solicitante, los aprueba el
            aprobador de su unidad y los entrega el responsable del almacén.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Aparte del `puedeCrear`: quien crea pedidos (el solicitador) NO es
              quien emite el registro, y quien lo emite (el observador) no crea
              nada. El registro es de almacén y administración; el solicitador y
              el aprobador ven sus pedidos en pantalla, pero emitirlo no es parte
              de su trabajo. `GET /egresos/reporte` los rechaza igual — esto solo
              evita ofrecer un botón que va a fallar. */}
          {puedeReportar && (
            <Button
              variant="outline"
              title="Registro de lo que salió del almacén: entregados y anulados."
              onClick={() => {
                // Al apretar Reporte se ajustan DOS filtros, por la misma razón:
                // ninguno de los dos dice CUÁLES documentos, que es lo único que
                // define un registro de archivo (2026-08-07).
                //
                // - **La bandeja** («de quién es el turno ahora») se apaga siempre.
                //   Para el aprobador y el responsable la pantalla abre con ella
                //   puesta, así que el primer clic salía en blanco y no había forma
                //   de adivinar que el arreglo era apagar un botón que nada
                //   relacionaba con el papel.
                // - **El estado** pasa a «entregados y anulados» SOLO si estaba en
                //   «todos»: son los dos que movieron stock. Sumar un pendiente al
                //   total es contar material que sigue en la estantería, y encima
                //   por la cantidad SOLICITADA — la entregada la ajusta el
                //   responsable recién al entregar. Un borrador, además, ni número
                //   tiene. Si el usuario eligió un estado a propósito se respeta,
                //   y el papel sale con lo que ve.
                //
                // Se ajusta la PANTALLA en vez de pisar los filtros solo del PDF
                // para que los dos sigan diciendo lo mismo —la razón por la que
                // `filtros` es un objeto único— y para que se vea por qué cambió.
                const paraElPapel: FiltrosEgresos = {
                  ...filtros,
                  pendientesMios: undefined,
                  estado:
                    estado === TODOS ? ESTADOS_CON_MOVIMIENTO : filtros.estado,
                }
                if (soloBandeja || estado === TODOS) {
                  cambiarFiltro(() => {
                    setSoloBandeja(false)
                    if (estado === TODOS) setEstado(MOVIMIENTO)
                  })
                }
                abrirReporte(paraElPapel, almacenReporte)
              }}
              disabled={generandoReporte}
            >
              {generandoReporte ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Reporte
            </Button>
          )}
          {puedeCrear && (
            <Button onClick={() => navigate("/egresos/nuevo")}>
              <Plus className="size-4" />
              Nuevo pedido
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(event) =>
              cambiarFiltro(() => setBusqueda(event.target.value))
            }
            placeholder="Buscar por justificación..."
            className="pl-9"
            aria-label="Buscar egresos"
          />
        </div>

        {/* El rango corre sobre la misma fecha que muestra la columna «Fecha»:
            la de envío y, mientras el pedido es borrador, la de creación. */}
        <DateRangeFilter
          value={rango}
          onChange={(nuevo) => cambiarFiltro(() => setRango(nuevo))}
          className="sm:w-60"
          aria-label="Filtrar por fecha"
        />

        {veVariosAlmacenes && (
          <Select
            value={almacenId}
            onValueChange={(valor) => cambiarFiltro(() => setAlmacenId(valor))}
          >
            <SelectTrigger className="sm:w-56" aria-label="Filtrar por almacén">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={TODOS}>Todos los almacenes</SelectItem>
              {almacenes.map((almacen) => (
                <SelectItem key={almacen.id} value={String(almacen.id)}>
                  {almacen.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {tieneBandeja && (
          <Button
            variant={soloBandeja ? "default" : "outline"}
            onClick={() => cambiarFiltro(() => setSoloBandeja(!soloBandeja))}
          >
            <Inbox className="size-4" />
            {soloBandeja ? "Solo mi bandeja" : "Todos"}
          </Button>
        )}

        <Select
          value={estado}
          onValueChange={(valor) =>
            cambiarFiltro(() => setEstado(valor as FiltroEstado))
          }
        >
          <SelectTrigger className="sm:w-64" aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            {/* Valor compuesto, no un estado: es lo que de verdad salió del
                almacén, y de lo que se hace el reporte. */}
            <SelectItem value={MOVIMIENTO}>Entregados y anulados</SelectItem>
            {/* En el selector va la etiqueta LARGA: hay ancho de sobra y elegir
                un filtro es justo cuando conviene saber a quién le toca. */}
            {ESTADOS.map((valor) => (
              <SelectItem key={valor} value={valor}>
                {ESTADO_DETALLE[valor]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Fecha</TableHead>
              {veVariosAlmacenes && <TableHead>Almacén</TableHead>}
              {veVariosSolicitantes && <TableHead>Solicitante</TableHead>}
              <TableHead>Justificación</TableHead>
              <TableHead className="text-center">Ítems</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending &&
              Array.from({ length: 5 }).map((_, fila) => (
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
                    "No se pudieron cargar los egresos."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isPending && !isError && egresos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columnas}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {soloBandeja ? (
                    // Bandeja vacía = callejón sin salida: la tabla no dice nada
                    // y la forma de llenarla es un botón de la barra de arriba
                    // que nada relaciona con lo que se está mirando. La salida va
                    // acá, que es donde el ojo se quedó.
                    <div className="flex flex-col items-center gap-3">
                      <span>No tenés pedidos esperando tu decisión.</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          cambiarFiltro(() => setSoloBandeja(false))
                        }
                      >
                        <Inbox className="size-4" />
                        Ver todos los pedidos
                      </Button>
                    </div>
                  ) : busquedaDiferida || estado !== TODOS ? (
                    "Ningún pedido coincide con los filtros."
                  ) : (
                    "Todavía no hay pedidos."
                  )}
                </TableCell>
              </TableRow>
            )}

            {!isError &&
              egresos.map((egreso) => (
                <TableRow
                  key={egreso.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/egresos/${egreso.id}`)}
                >
                  <TableCell className="font-medium whitespace-nowrap">
                    {etiquetaNumero(egreso)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fecha(egreso.fechaEnvio ?? egreso.createdAt)}
                  </TableCell>
                  {veVariosAlmacenes && (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {egreso.almacen.nombre}
                    </TableCell>
                  )}
                  {veVariosSolicitantes && (
                    <TableCell>{egreso.solicitante.nombre}</TableCell>
                  )}
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {egreso.justificacion}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {egreso._count.detalles}
                  </TableCell>
                  <TableCell>
                    <BadgeEstado tono={ESTADO_PUNTO[egreso.estado]}>
                      {ESTADO_LABEL[egreso.estado]}
                    </BadgeEstado>
                  </TableCell>
                  <TableCell
                    className="text-right whitespace-nowrap"
                    // La fila navega al detalle: los botones no deben arrastrar
                    // ese clic.
                    onClick={(event) => event.stopPropagation()}
                  >
                    {puedeGestionar(egreso) && (
                      <>
                        <IconAction
                          icono={Pencil}
                          etiqueta="Editar el pedido"
                          onClick={() => navigate(`/egresos/${egreso.id}`)}
                          className={TONO_ACCION.editar}
                        />
                        <IconAction
                          icono={Send}
                          etiqueta="Enviar a aprobador unidad"
                          onClick={() => setAEnviar(egreso)}
                          className={TONO_ACCION.enviar}
                        />
                      </>
                    )}
                    {puedeImprimir && egreso.estado !== "BORRADOR" && (
                      <IconAction
                        icono={generandoId === egreso.id ? Loader2 : FileText}
                        etiqueta="Ver la solicitud en PDF"
                        onClick={() => void abrirSolicitud(egreso.id)}
                        disabled={generandoId === egreso.id}
                        className={TONO_ACCION.pdf}
                        // Macizo (relleno del color del texto, trazo del color
                        // del fondo) y un punto más grande que el resto: es la
                        // acción que más se busca en la fila.
                        //
                        // El `size-5` va SIEMPRE, también con el spinner: si el
                        // tamaño cambiara al empezar a generar, la fila daría un
                        // salto. Lo único que se saca es el relleno — un
                        // `Loader2` macizo sería una mancha girando.
                        iconoClassName={
                          generandoId === egreso.id
                            ? "size-5"
                            : `size-5 ${MACIZO}`
                        }
                      />
                    )}
                    {/* Disponible para todos: ver quién movió el pedido y cuándo
                        es lo que más se consulta, y hasta ahora costaba entrar a
                        la ficha. */}
                    <IconAction
                      icono={TrendingUp}
                      etiqueta="Ver historial"
                      onClick={() => setHistorialDe(egreso.id)}
                      className={TONO_ACCION.ver}
                    />

                    {/* Descartar va SIEMPRE al final: es la única irreversible,
                        y separarla de las demás baja la chance de un clic por
                        inercia. */}
                    {puedeGestionar(egreso) && (
                      <IconAction
                        icono={Trash2}
                        etiqueta="Descartar el pedido"
                        destructiva
                        onClick={() => setADescartar(egreso)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {data && (
        <DataPagination
          meta={data.meta}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          entidad="egresos"
        />
      )}

      {aEnviar && (
        <EnviarDialog egresoId={aEnviar.id} onClose={() => setAEnviar(null)} />
      )}

      {/* Se monta solo al abrirse: el historial no viaja en el listado y el
          panel tiene que pedir el detalle del pedido. */}
      {historialDe != null && (
        <HistorialSheet
          egresoId={historialDe}
          onClose={() => setHistorialDe(null)}
        />
      )}

      {/* Visor propio: nunca están abiertos los dos a la vez, pero cada hook
          maneja su object URL y lo revoca al cerrarse. */}

      <AlertDialog
        open={aDescartar !== null}
        onOpenChange={(abierto) => !abierto && setADescartar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar el pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina y libera el stock que tenía reservado. A diferencia del
              resto del sistema, un pedido sin enviar sí se borra: todavía no es
              un documento ni movió existencias.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={descartar.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={descartar.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!aDescartar) return
                void descartar
                  .mutateAsync(aDescartar.id)
                  .then(() => setADescartar(null))
                  .catch(() => undefined)
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
