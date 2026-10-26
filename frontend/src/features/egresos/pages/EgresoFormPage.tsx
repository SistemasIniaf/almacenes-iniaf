import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  Ban,
  Check,
  TrendingUp,
  ImageOff,
  Loader2,
  FileText,
  Save,
  Send,
  X,
} from "lucide-react"

import { AvisoImagenReferencial } from "@/components/data/AvisoImagenReferencial"
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
import { BadgeEstado } from "@/components/data/BadgeEstado"
import { NumeroDocumento } from "@/components/data/NumeroDocumento"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TextareaField } from "@/components/form/TextareaField"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { EgresoLineas } from "@/features/egresos/components/EgresoLineas"
import { EnviarDialog } from "@/features/egresos/components/EnviarDialog"
import { HistorialSheet } from "@/features/egresos/components/HistorialSheet"
import {
  useActualizarEgreso,
  useAnularEgreso,
  useAprobarEgreso,
  useCrearEgreso,
  useEgreso,
  useEntregarEgreso,
  useEnviarEgreso,
  useRechazarEgreso,
} from "@/features/egresos/hooks/useEgresos"
import {
  aPayload,
  aPayloadEdicion,
  desdeEgreso,
  egresoSchema,
  VALORES_INICIALES,
} from "@/features/egresos/egresos.schema"
import { useSolicitudPdf } from "@/features/egresos/hooks/useSolicitudPdf"
import { urlArchivo } from "@/lib/files"
import {
  describirPaso,
  descripcionConNota,
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
  rechazoVigente,
} from "@/features/egresos/egresos.types"

import type { FieldErrors } from "react-hook-form"
import type { EgresoFormValues } from "@/features/egresos/egresos.schema"
import type { LoteDeLinea } from "@/features/egresos/egresos.types"
import type { LoteElegible } from "@/features/egresos/hooks/useBuscarLotes"

/**
 * Miniatura del material de una línea, **ampliable al hacer clic**: la foto del
 * catálogo del ítem, la misma que el selector. Si no tiene, muestra un marco
 * vacío del mismo tamaño, para que las filas de la tabla no cambien de alto entre una y
 * otra.
 *
 * Se amplía porque 40 px alcanzan para reconocer, no para revisar: quien está a
 * punto de entregar necesita mirar de cerca que sea ese material y no otro.
 * Hermana de `FotoLote` en `EgresoLineas` (que hace lo mismo al pedir), pero no
 * se comparten: una trabaja sobre `LoteElegible` —lo que devuelve el buscador de
 * stock— y ésta sobre la línea ya guardada, que traen datos distintos.
 */
function MiniaturaLote({ lote }: { lote: LoteDeLinea }) {
  const [ampliada, setAmpliada] = useState(false)
  const src = urlArchivo(lote.item.imagenUrl)
  const etiqueta = descripcionConNota(lote.item.descripcion, lote.observacion)

  if (!src) {
    return (
      <span className="flex size-10 items-center justify-center rounded border border-dashed bg-muted/40">
        <ImageOff className="size-4 text-muted-foreground/60" />
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        className="size-10 overflow-hidden rounded border transition-opacity hover:opacity-80"
        aria-label={`Ver foto de ${etiqueta}`}
      >
        <img
          src={src}
          alt={etiqueta}
          className="size-full object-cover"
          loading="lazy"
        />
      </button>

      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{etiqueta}</DialogTitle>
            <DialogDescription>
              {lote.item.codigo} · ingreso {etiquetaNumero(lote.ingreso)} ·{" "}
              {lote.ingreso.fuenteFinanciamiento?.nombre ?? "Sin fuente"}
            </DialogDescription>
          </DialogHeader>
          <img
            src={src}
            alt={etiqueta}
            className="max-h-[60vh] w-full rounded object-contain"
          />
          <AvisoImagenReferencial />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function EgresoFormPage() {
  const { id: idParam } = useParams()
  const id = idParam ? Number(idParam) : undefined
  const esNuevo = id == null
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: egreso, isPending: cargando } = useEgreso(id)
  const crear = useCrearEgreso()
  const actualizar = useActualizarEgreso()
  const enviar = useEnviarEgreso()
  const aprobar = useAprobarEgreso()
  const rechazar = useRechazarEgreso()
  const anular = useAnularEgreso()
  const entregar = useEntregarEgreso()
  const { abrirSolicitud, generandoId, puedeImprimir } = useSolicitudPdf()

  // Entregar edita EN LA MISMA tabla de abajo (pedido del usuario, 2026-10-13):
  // antes era un modal aparte que repetía Ítem/Unidad/Pedido. `entregando`
  // decide si la columna «Entregado» se ve como texto o como input.
  const [entregando, setEntregando] = useState(false)
  const [cantidadesEntrega, setCantidadesEntrega] = useState<
    Record<number, string>
  >({})
  const [dialogoEnviar, setDialogoEnviar] = useState(false)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [accionConMotivo, setAccionConMotivo] = useState<
    "rechazar" | "anular" | null
  >(null)
  const [motivo, setMotivo] = useState("")

  const { control, handleSubmit, reset } = useForm<EgresoFormValues>({
    resolver: zodResolver(egresoSchema),
    defaultValues: VALORES_INICIALES,
  })

  useEffect(() => {
    if (esNuevo || !egreso) return
    reset(desdeEgreso(egreso))
  }, [esNuevo, egreso, reset])

  const estado = egreso?.estado
  const esPropio = egreso?.solicitante.id === user?.id
  const rechazo = egreso ? rechazoVigente(egreso) : null
  // El borrador es lo único editable, y solo por su dueño. Enviado, el pedido
  // ya es problema de otro.
  const editable = esNuevo || (estado === "BORRADOR" && esPropio)

  const puedeAprobar =
    estado === "PENDIENTE_APROBADOR" &&
    (user?.rol === "aprobador" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")
  const puedeEntregar =
    estado === "PENDIENTE_RESPONSABLE_ALMACEN" &&
    (user?.rol === "responsable_almacen" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")
  const puedeRechazar = puedeAprobar || puedeEntregar
  const puedeAnular =
    estado === "ENTREGADO" &&
    (user?.rol === "responsable_almacen" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")
  // Separa las acciones de INFORMACIÓN (Historial, Enviar, Ver PDF) de las de
  // DECISIÓN sobre el pedido — para que aprobar/rechazar no se pierdan entre
  // botones secundarios en la misma fila.
  const hayAccionDecision = puedeRechazar || puedeAnular

  const ocupado =
    crear.isPending ||
    actualizar.isPending ||
    enviar.isPending ||
    aprobar.isPending ||
    rechazar.isPending ||
    anular.isPending ||
    entregar.isPending

  // Mientras se entrega, no se puede confirmar más de lo pedido — misma
  // regla que exigía el modal que reemplazó esto.
  const excedidasEntrega = (egreso?.detalles ?? []).filter((d) => {
    const valor = Number(cantidadesEntrega[d.id] ?? 0)
    return Number.isNaN(valor) || valor > Number(d.cantidadSolicitada)
  })

  /**
   * Lotes que el pedido ya referencia. Van al selector porque su lista es una
   * búsqueda del servidor: sin esto, un lote ya elegido aparecería en blanco —
   * y encima puede haber quedado sin disponible justamente porque este pedido lo
   * reservó.
   */
  const lotesIniciales: LoteElegible[] = (egreso?.detalles ?? []).map((d) => ({
    id: d.ingresoDetalle.id,
    itemCodigo: d.ingresoDetalle.item.codigo,
    itemDescripcion: d.ingresoDetalle.item.descripcion,
    observacion: d.ingresoDetalle.observacion,
    unidadMedida: d.ingresoDetalle.item.unidadMedida,
    imagen: urlArchivo(d.ingresoDetalle.item.imagenUrl),
    fuente:
      d.ingresoDetalle.ingreso.fuenteFinanciamiento?.nombre ?? "Sin fuente",
    numeroIngreso: etiquetaNumero(d.ingresoDetalle.ingreso),
    disponible: Number(d.ingresoDetalle.saldoCantidad),
  }))

  /**
   * El formulario no se envió porque algo no validó. Sin esto, el botón parecía
   * no hacer NADA: los errores de las líneas quedan dentro de sus tarjetas, más
   * abajo, y si no agregaste ninguna el error del arreglo no lo pintaba ningún
   * campo. El toast dice qué falta y `handleSubmit` ya lleva el foco al primer
   * campo con error.
   */
  function avisarInvalido(errores: FieldErrors<EgresoFormValues>) {
    if (errores.detalles) {
      const raiz = (errores.detalles as { root?: { message?: string } }).root
      toast.error(
        raiz?.message ??
          errores.detalles.message ??
          "Revisá los ítems del pedido: hay líneas incompletas."
      )
      return
    }
    toast.error("Faltan datos: revisá los campos marcados en rojo.")
  }

  async function guardar(valores: EgresoFormValues) {
    try {
      if (esNuevo) {
        // Al listado, no a la ficha del pedido recién creado: guardar termina la
        // tarea, y quedarse en el formulario se leía como que no había pasado
        // nada. Desde la tabla se ve el pedido con su estado y a un clic están
        // sus acciones (enviar, editar, descartar), que viven ahí.
        await crear.mutateAsync(aPayload(valores))
        navigate("/egresos")
      } else {
        await actualizar.mutateAsync({
          id: id as number,
          ...aPayloadEdicion(valores),
        })
      }
    } catch {
      // El toast lo emite la mutación (sin disponible, lote de otro almacén…).
    }
  }

  // Arranca proponiendo lo pedido, que es el caso normal: bajar una cantidad
  // cubre el faltante físico. Se inicializa acá (al hacer clic), no en un
  // efecto — es lo mismo que evitaba el modal con su montaje condicional.
  function iniciarEntrega() {
    if (!egreso) return
    setCantidadesEntrega(
      Object.fromEntries(
        egreso.detalles.map((d) => [d.id, String(Number(d.cantidadSolicitada))])
      )
    )
    setEntregando(true)
  }

  function cancelarEntrega() {
    setEntregando(false)
  }

  async function confirmarEntrega() {
    if (!egreso) return
    try {
      await entregar.mutateAsync({
        id: egreso.id,
        lineas: egreso.detalles.map((d) => ({
          detalleId: d.id,
          cantidadEntregada: Number(cantidadesEntrega[d.id] ?? 0),
        })),
      })
      setEntregando(false)
    } catch {
      // El toast lo emite la mutación (ej. el lote se quedó sin saldo); se
      // queda en modo entrega para bajar la cantidad.
    }
  }

  async function confirmarMotivo() {
    if (!accionConMotivo || id == null) return
    try {
      if (accionConMotivo === "rechazar") {
        await rechazar.mutateAsync({ id, motivo: motivo.trim() })
      } else {
        await anular.mutateAsync({ id, motivo: motivo.trim() })
      }
      setAccionConMotivo(null)
      setMotivo("")
    } catch {
      /* toast en la mutación */
    }
  }

  if (!esNuevo && cargando) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2"
            onClick={() => navigate("/egresos")}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          {/* Sin número todavía (borrador): «Pedido» a secas. Antes salía
              «Pedido —», con un guión suelto que no dice nada. La unidad, el
              almacén y el solicitante NO van acá: están en el bloque de datos,
              que se muestra igual en edición y en lectura. */}
          <h1 className="text-2xl font-semibold tracking-tight">
            {esNuevo
              ? "Nuevo pedido"
              : egreso?.numero == null
                ? "Pedido"
                : `Pedido ${etiquetaNumero(egreso)}`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {estado && (
            <BadgeEstado tono={ESTADO_PUNTO[estado]}>
              {ESTADO_LABEL[estado]}
            </BadgeEstado>
          )}

          {/* Acá arriba van solo las acciones sobre el DOCUMENTO (enviar,
              aprobar, entregar, anular, imprimir). El submit del formulario está
              al pie, dentro del propio form, como en el de ingresos.

              Descartar tampoco está acá: es una acción de limpieza, no un paso
              del circuito. Vive en el listado, como acción de fila. */}
          {!esNuevo && (
            <Button variant="outline" onClick={() => setHistorialAbierto(true)}>
              <TrendingUp className="size-4" />
              Historial
            </Button>
          )}

          {!entregando && !esNuevo && editable && (
            <Button
              variant="secondary"
              disabled={ocupado}
              onClick={() => setDialogoEnviar(true)}
            >
              <Send className="size-4" />
              Enviar a aprobador unidad
            </Button>
          )}

          {/* Solo si hubo entrega (`fechaEntrega`): ENTREGADO, o ANULADO
              después de entregado. Se mira la fecha y no el estado porque un
              devuelto desistido también queda ANULADO sin haber salido nada
              del almacén. Pedido del usuario, 2026-10-13:
              mientras está pendiente de aprobación o de entrega no hay nada
              que imprimir todavía, solo lo hay una vez que el material
              efectivamente salió del almacén. */}
          {!entregando &&
            egreso &&
            egreso.fechaEntrega != null &&
            puedeImprimir && (
              <Button
                variant="outline"
                disabled={generandoId === egreso.id}
                onClick={() => void abrirSolicitud(egreso)}
              >
                {/* Mismo icono que en el listado. Acá NO va en rojo: dentro de un
                  botón con texto, el rojo se lee como acción peligrosa. */}
                {generandoId === egreso.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Ver PDF
              </Button>
            )}

          {/* De acá para abajo, acciones de DECISIÓN sobre el pedido: separadas
              de Historial/Enviar/Ver PDF (información), que ya no compiten por
              la atención con aprobar o rechazar. Entregando cuenta como
              decisión en curso, aunque Aprobar/Rechazar/Anular estén ocultos
              mientras tanto. */}
          {(entregando || hayAccionDecision) && (
            <Separator orientation="vertical" className="h-6" />
          )}

          {!entregando && puedeAprobar && (
            <Button
              disabled={ocupado}
              onClick={() => void aprobar.mutateAsync(id as number)}
            >
              <Check className="size-4" />
              Aprobar
            </Button>
          )}
          {!entregando && puedeEntregar && (
            <Button disabled={ocupado} onClick={iniciarEntrega}>
              <Check className="size-4" />
              Entregar
            </Button>
          )}

          {/* Modo entrega: reemplaza Aprobar/Entregar/Rechazar/Anular por
              estos dos — la columna «Entregado» de la tabla de abajo pasa a
              ser editable mientras tanto (pedido del usuario, 2026-10-13:
              antes esto era un modal aparte). */}
          {entregando && (
            <>
              <Button
                variant="outline"
                disabled={entregar.isPending}
                onClick={cancelarEntrega}
              >
                Cancelar
              </Button>
              <Button
                disabled={entregar.isPending || excedidasEntrega.length > 0}
                onClick={() => void confirmarEntrega()}
              >
                {entregar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Confirmar entrega
              </Button>
            </>
          )}

          {!entregando && puedeRechazar && (
            <Button
              variant="destructive"
              disabled={ocupado}
              onClick={() => setAccionConMotivo("rechazar")}
            >
              <X className="size-4" />
              Rechazar
            </Button>
          )}
          {!entregando && puedeAnular && (
            <Button
              variant="destructive"
              disabled={ocupado}
              onClick={() => setAccionConMotivo("anular")}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* El motivo del rechazo es lo único que le dice al solicitante qué
          corregir: va a la vista, no escondido en el historial. */}
      {rechazo && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">
            Devuelto por el {describirPaso(rechazo).actor.toLowerCase()} (
            {rechazo.usuario.nombre}) el{" "}
            {new Date(rechazo.createdAt).toLocaleString("es-BO", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            :
          </span>{" "}
          {rechazo.motivo}
          {esPropio && (
            <p className="mt-1 text-muted-foreground">
              Corregí el pedido y volvé a enviarlo: arranca otra vez desde el
              aprobador de unidad. El stock queda reservado 48 h desde el
              rechazo.
            </p>
          )}
        </div>
      )}

      {estado === "ANULADO" && egreso?.motivoAnulacion && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Anulado:</span> {egreso.motivoAnulacion}
        </div>
      )}

      {/* TODO el pedido en UNA sola tarjeta — información, justificación e
          ítems son secciones de un mismo documento, no piezas sueltas (pedido
          del usuario, 2026-10-12). Separadas con `Separator`, no con tarjetas
          independientes apiladas. */}
      <div className="rounded-md border bg-card shadow-sm">
        {/* De quién es el pedido. No se elige: el almacén y la unidad los
            hereda del solicitante (ver "Regla de negocio crítica" en
            CLAUDE.md), así que se muestran como dato, no como campo. Se ve
            igual en edición y en lectura — es el único lugar donde figuran,
            desde que se quitó la línea repetida bajo el título. Al crear
            salen del perfil (el registro todavía no existe); después, del
            propio egreso, que es la fuente de verdad. */}
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Solicitante</p>
            <p className="text-sm font-medium">
              {egreso?.solicitante.nombre ?? user?.nombre ?? "—"}
            </p>
            {(egreso?.solicitante.cargo ?? user?.cargo) && (
              <p className="text-xs text-muted-foreground">
                {egreso?.solicitante.cargo ?? user?.cargo}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unidad solicitante</p>
            <p className="text-sm font-medium">
              {egreso?.unidad.nombre ?? user?.unidad?.nombre ?? "—"}
            </p>
            {(egreso?.unidad.sigla ?? user?.unidad?.sigla) && (
              <p className="text-xs text-muted-foreground">
                {egreso?.unidad.sigla ?? user?.unidad?.sigla}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Almacén</p>
            <p className="text-sm font-medium">
              {egreso?.almacen.nombre ?? user?.almacen?.nombre ?? "—"}
            </p>
          </div>
        </div>

        <Separator />

        {editable ? (
          <form
            id="egreso-form"
            onSubmit={handleSubmit(guardar, avisarInvalido)}
            className="flex flex-col gap-4 p-4"
          >
            <TextareaField
              name="justificacion"
              label="Justificación"
              control={control}
              rows={2}
              placeholder="Para qué se pide el material"
              description="Máximo 300 caracteres."
              disabled={ocupado}
            />
            {/* Los ítems SON el pedido: la justificación es lo que lo explica,
                pero lo que sale del almacén es esto. Panel con superficie
                propia, igual que en el formulario de ingreso. */}
            <div className="rounded-md border bg-muted/30 p-4">
              <EgresoLineas
                control={control}
                disabled={ocupado}
                lotesIniciales={lotesIniciales}
              />
            </div>

            {/* Acción principal al pie del formulario — igual que el de
                ingresos. Queda al final de lo que hay que completar, no en la
                barra de arriba junto a las acciones del documento. */}
            <div className="mt-2 flex justify-end">
              <Button type="submit" disabled={ocupado}>
                {ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar
              </Button>
            </div>
          </form>
        ) : (
          egreso && (
            <>
              <div className="p-4">
                <p className="text-xs text-muted-foreground">Justificación</p>
                <p className="text-sm">{egreso.justificacion}</p>
              </div>

              <Separator />

              {/* Nota de modo entrega: solo el texto explicativo general. El
                  error de "excede lo pedido" NO va acá (quedaba lejos de la
                  fila que realmente falla, pedido del usuario 2026-10-13) —
                  va pegado a cada input inválido, más abajo. */}
              {entregando && (
                <>
                  <div className="bg-muted/30 p-4 text-sm text-muted-foreground">
                    Al confirmar se descuenta el stock de cada lote y queda la
                    salida en el Kardex. Si de algo hay menos de lo que dice el
                    sistema, bajá la cantidad.
                  </div>
                  <Separator />
                </>
              )}

              {/* Redondea solo las esquinas de ABAJO: la tabla no es la
                  primera sección de la tarjeta, así que sus esquinas de
                  arriba van rectas — `rounded-[inherit]` (lo que usa `Table`
                  por default) tomaría las cuatro del borde exterior y dejaba
                  un par de puntas redondeadas sueltas a mitad de tarjeta. */}
              <div className="overflow-hidden rounded-b-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Columna de la foto, sin rótulo visible: la miniatura se
                        explica sola y un encabezado gastaría alto para nada. */}
                      <TableHead className="w-14">
                        <span className="sr-only">Foto</span>
                      </TableHead>
                      <TableHead>Ítem</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead>Ingreso</TableHead>
                      {/* La unidad va en columna propia, no pegada a cada número:
                        así no hay que pluralizarla («4 PIEZA») ni inventar reglas
                        para las abreviaturas, que son invariables (KG, LT, M2).
                        Es la misma disposición que el PDF de la solicitud. */}
                      <TableHead className="text-center">Unidad</TableHead>
                      <TableHead className="text-right">Pedido</TableHead>
                      <TableHead className="text-right">Entregado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {egreso.detalles.map((detalle) => (
                      <TableRow key={detalle.id}>
                        <TableCell>
                          <MiniaturaLote lote={detalle.ingresoDetalle} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>
                              {descripcionConNota(
                                detalle.ingresoDetalle.item.descripcion,
                                detalle.ingresoDetalle.observacion
                              )}
                            </span>
                            {/* Solo mientras se entrega: es el dato que hace
                                falta para decidir la cantidad, no algo que
                                importe mirar en el resto de los estados. */}
                            {entregando && (
                              <span className="text-xs text-muted-foreground">
                                Saldo del lote:{" "}
                                {Number(detalle.ingresoDetalle.saldoCantidad)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {detalle.ingresoDetalle.ingreso.fuenteFinanciamiento
                            ?.nombre ?? "—"}
                        </TableCell>
                        <TableCell>
                          <NumeroDocumento
                            numero={detalle.ingresoDetalle.ingreso.numero}
                            gestion={detalle.ingresoDetalle.ingreso.gestion}
                          />
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap text-muted-foreground">
                          {detalle.ingresoDetalle.item.unidadMedida}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(detalle.cantidadSolicitada)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entregando ? (
                            (() => {
                              const pedido = Number(detalle.cantidadSolicitada)
                              const valor = Number(
                                cantidadesEntrega[detalle.id] ?? 0
                              )
                              const excedida = valor > pedido
                              return (
                                <div className="flex flex-col items-end gap-1">
                                  <Input
                                    type="number"
                                    // `any` y no "0.01": con un paso decimal
                                    // las flechas mueven de a un centésimo,
                                    // que no es como se entrega material. Así
                                    // se mueven de a 1 y los decimales se
                                    // siguen pudiendo escribir (hay ítems en
                                    // kilos y litros).
                                    step="any"
                                    min={0}
                                    max={pedido}
                                    value={cantidadesEntrega[detalle.id] ?? ""}
                                    onChange={(event) =>
                                      setCantidadesEntrega((previas) => ({
                                        ...previas,
                                        [detalle.id]: event.target.value,
                                      }))
                                    }
                                    aria-invalid={excedida}
                                    className="w-24 text-right"
                                    aria-label={`Cantidad a entregar de ${detalle.ingresoDetalle.item.descripcion}`}
                                    // Misma guarda que `NumberField`: sin
                                    // esto, scrollear la página con el
                                    // puntero sobre el campo le cambia el
                                    // valor.
                                    onWheel={(event) =>
                                      event.currentTarget.blur()
                                    }
                                  />
                                  {/* Pegado a la fila que falla, no en un
                                      cartel arriba de toda la tabla (pedido
                                      del usuario, 2026-10-13): con varias
                                      líneas, un aviso genérico arriba no dice
                                      CUÁL está mal. */}
                                  {excedida && (
                                    <span className="text-xs text-destructive">
                                      No puede superar lo pedido ({pedido})
                                    </span>
                                  )}
                                </div>
                              )
                            })()
                          ) : (
                            <span className="tabular-nums">
                              {detalle.cantidadEntregada == null
                                ? "—"
                                : Number(detalle.cantidadEntregada)}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )
        )}
      </div>

      {/* El historial NO se muestra acá: se abre a pedido, con el botón
          «Historial» de la barra de arriba, igual que desde el listado. La ficha
          es para trabajar el pedido; la traza se consulta cuando hace falta. */}
      {historialAbierto && id != null && (
        <HistorialSheet
          egresoId={id}
          onClose={() => setHistorialAbierto(false)}
        />
      )}

      {/* Se monta solo al abrirse: así consulta el aprobador recién cuando hace
          falta. */}
      {dialogoEnviar && id != null && (
        <EnviarDialog egresoId={id} onClose={() => setDialogoEnviar(false)} />
      )}

      <AlertDialog
        open={accionConMotivo !== null}
        onOpenChange={(abierto) => !abierto && setAccionConMotivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accionConMotivo === "rechazar"
                ? "¿Rechazar el pedido?"
                : "¿Anular el egreso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accionConMotivo === "rechazar"
                ? "Vuelve al solicitante para que lo corrija y lo envíe de nuevo. Conserva su número."
                : "El material vuelve a sus lotes y queda una reversión en el Kardex. Anular dice que la salida nunca debió existir: no es el camino para material que se devuelve."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Motivo (obligatorio)"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={accionConMotivo === "anular" ? "destructive" : "default"}
              disabled={ocupado || motivo.trim().length === 0}
              onClick={(event) => {
                // Sin esto el diálogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarMotivo()
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
