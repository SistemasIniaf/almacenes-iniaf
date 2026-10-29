import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import {
  ArrowLeft,
  Ban,
  Check,
  CircleOff,
  TrendingUp,
  ImageOff,
  Loader2,
  FileText,
  PackageCheck,
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
import { AvisoReserva } from "@/features/egresos/components/AvisoReserva"
import { EgresoLineas } from "@/features/egresos/components/EgresoLineas"
import { EnviarDialog } from "@/features/egresos/components/EnviarDialog"
import { EsperaPedido } from "@/features/egresos/components/EsperaPedido"
import { HistorialSheet } from "@/features/egresos/components/HistorialSheet"
import {
  useActualizarEgreso,
  useAnularEgreso,
  useAprobarEgreso,
  useCrearEgreso,
  useDesistirEgreso,
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
import { cantidad, documentoDeLote } from "@/lib/formato"
import { cn } from "@/lib/utils"
import {
  describirPaso,
  descripcionConNota,
  esRechazo,
  ESTADO_LABEL,
  ESTADO_PUNTO,
  ESTADOS_DEL_SOLICITANTE,
  etiquetaNumero,
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
              {lote.item.codigo} · {documentoDeLote(lote.ingreso)} ·{" "}
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
  const desistir = useDesistirEgreso()
  const entregar = useEntregarEgreso()
  const { abrirSolicitud, generandoId, puedeImprimir } = useSolicitudPdf()

  // Lo que el responsable CAMBIÓ de la cantidad a entregar; lo que no tocó
  // vale lo pedido (`aEntregar`). Guardar solo los cambios evita inicializar
  // en un efecto, que el lint del repo rechaza.
  const [cantidadesEntrega, setCantidadesEntrega] = useState<
    Record<number, string>
  >({})
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)
  // «Guardar y enviar»: los valores ya validados, a la espera de que se
  // confirme el envío (recién ahí se crea o se guarda).
  const [paraEnviar, setParaEnviar] = useState<EgresoFormValues | null>(null)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [accionConMotivo, setAccionConMotivo] = useState<
    "rechazar" | "anular" | "desistir" | null
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
  // Lo editable es lo que está en manos del solicitante (sin enviar o
  // devuelto), y solo por su dueño. Enviado, el pedido ya es problema de otro.
  const editable =
    esNuevo ||
    (estado !== undefined &&
      ESTADOS_DEL_SOLICITANTE.includes(estado) &&
      esPropio)

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
  // Quien puede entregar ve la tabla YA en modo entrega, con las cantidades
  // editables (2026-10-29, pedido del usuario). Antes había que tocar
  // «Entregar» para que aparecieran, y se leía como que ese botón ya
  // entregaba: nadie se daba cuenta de que primero se ajustaban las cantidades.
  const entregando = puedeEntregar
  const puedeAnular =
    estado === "ENTREGADO" &&
    (user?.rol === "responsable_almacen" ||
      user?.rol === "admin" ||
      user?.rol === "super_admin")
  // Un DEVUELTO no se descarta: se desiste (ver `puedeDesistir` en el listado,
  // misma regla que el backend).
  const puedeDesistir =
    estado === "DEVUELTO" &&
    (esPropio || user?.rol === "admin" || user?.rol === "super_admin")
  // Quién lo devolvió y por qué: el último rechazo del historial. Va arriba de
  // la ficha porque es lo primero que el solicitante necesita para corregir.
  const rechazo =
    estado === "DEVUELTO"
      ? egreso?.historial.findLast((paso) => esRechazo(paso))
      : undefined
  // Separa las acciones de INFORMACIÓN (Historial, Enviar, Ver PDF) de las de
  // DECISIÓN sobre el pedido — para que aprobar/rechazar no se pierdan entre
  // botones secundarios en la misma fila.
  // Aprobar, entregar y rechazar NO están acá: van al pie de la ficha, debajo
  // de lo que se está decidiendo (como Guardar y enviar en el formulario).
  const hayAccionDecision = puedeAnular || puedeDesistir
  // El motivo de un desistido vive en su historial (no hay columna aparte,
  // como la del anulado): es el del último paso.
  const motivoDesistido =
    estado === "DESISTIDO" ? egreso?.historial.at(-1)?.motivo : null

  const ocupado =
    crear.isPending ||
    actualizar.isPending ||
    enviar.isPending ||
    aprobar.isPending ||
    rechazar.isPending ||
    anular.isPending ||
    desistir.isPending ||
    entregar.isPending

  // Arranca en lo pedido, que es el caso normal: bajarla cubre el faltante.
  const aEntregar = (detalleId: number, cantidadSolicitada: string | number) =>
    cantidadesEntrega[detalleId] ?? String(Number(cantidadSolicitada))

  // No se puede confirmar más de lo pedido.
  const excedidasEntrega = (egreso?.detalles ?? []).filter((d) => {
    const valor = Number(aEntregar(d.id, d.cantidadSolicitada))
    return Number.isNaN(valor) || valor > Number(d.cantidadSolicitada)
  })
  // Las que salen con menos de lo pedido: el diálogo de confirmación las
  // nombra, para que un número mal tipeado no pase de largo.
  const reducidasEntrega = (egreso?.detalles ?? []).filter(
    (d) =>
      Number(aEntregar(d.id, d.cantidadSolicitada)) <
      Number(d.cantidadSolicitada)
  )

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
    documento: documentoDeLote(d.ingresoDetalle.ingreso),
    // Lo que puede pedir ESTE pedido, calculado por el backend (sin restarse
    // su propia reserva). `null` solo fuera de edición, donde no se usa.
    disponible: d.disponible ?? Number(d.ingresoDetalle.saldoCantidad),
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
        toast.success("Pedido guardado. Falta enviarlo al aprobador de unidad")
        navigate("/egresos")
      } else {
        await actualizar.mutateAsync({
          id: id as number,
          ...aPayloadEdicion(valores),
        })
        toast.success(
          estado === "DEVUELTO"
            ? "Cambios guardados. Falta reenviarlo al aprobador de unidad"
            : "Cambios guardados. Falta enviarlo al aprobador de unidad"
        )
        navigate("/egresos")
      }
    } catch {
      // El toast lo emite la mutación (sin disponible, lote de otro almacén…).
    }
  }

  async function confirmarEntrega() {
    if (!egreso) return
    try {
      await entregar.mutateAsync({
        id: egreso.id,
        lineas: egreso.detalles.map((d) => ({
          detalleId: d.id,
          cantidadEntregada: Number(aEntregar(d.id, d.cantidadSolicitada)),
        })),
      })
      setConfirmandoEntrega(false)
      setCantidadesEntrega({})
    } catch {
      // El toast lo emite la mutación (ej. el lote se quedó sin saldo); se
      // cierra el diálogo para que pueda bajar la cantidad.
      setConfirmandoEntrega(false)
    }
  }

  async function confirmarMotivo() {
    if (!accionConMotivo || id == null) return
    try {
      if (accionConMotivo === "rechazar") {
        await rechazar.mutateAsync({ id, motivo: motivo.trim() })
      } else if (accionConMotivo === "desistir") {
        await desistir.mutateAsync({ id, motivo: motivo.trim() })
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

          {/* Acá arriba van solo las acciones sobre el DOCUMENTO (aprobar,
              entregar, anular, desistir, imprimir). Guardar y enviar están al
              pie, dentro del propio form, como en el de ingresos: enviar desde
              acá mandaba el pedido SIN los cambios que no se habían guardado.

              Descartar tampoco está acá: es una acción de limpieza, no un paso
              del circuito. Vive en el listado, como acción de fila. */}
          {!esNuevo && (
            <Button variant="outline" onClick={() => setHistorialAbierto(true)}>
              <TrendingUp className="size-4" />
              Historial
            </Button>
          )}

          {/* Solo ENTREGADO (o ANULADO, que siempre viene despues de entregado
              — ver la maquina de estados) — pedido del usuario, 2026-10-13:
              mientras está pendiente de aprobación o de entrega no hay nada
              que imprimir todavía, solo lo hay una vez que el material
              efectivamente salió del almacén. */}
          {egreso &&
            (estado === "ENTREGADO" || estado === "ANULADO") &&
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

          {/* De acá para abajo, acciones de DECISIÓN sobre un pedido cerrado:
              separadas de Historial/Ver PDF (información). */}
          {hayAccionDecision && (
            <Separator orientation="vertical" className="h-6" />
          )}

          {puedeAnular && (
            <Button
              variant="destructive"
              disabled={ocupado}
              onClick={() => setAccionConMotivo("anular")}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
          {puedeDesistir && (
            <Button
              variant="destructive"
              disabled={ocupado}
              onClick={() => setAccionConMotivo("desistir")}
            >
              <CircleOff className="size-4" />
              Desistir
            </Button>
          )}
        </div>
      </div>

      {estado === "ANULADO" && egreso?.motivoAnulacion && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Anulado:</span> {egreso.motivoAnulacion}
        </div>
      )}
      {rechazo && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <span className="font-medium">
            Devuelto por {rechazo.usuario?.nombre ?? "—"} (
            {describirPaso(rechazo).actor.toLowerCase()}):
          </span>{" "}
          {rechazo.motivo}
          {esPropio && (
            <span className="text-muted-foreground">
              {" "}
              · Corregilo y volvé a enviarlo, o desistí si ya no lo necesitás.
            </span>
          )}
        </div>
      )}
      {motivoDesistido && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Desistido:</span> {motivoDesistido}
        </div>
      )}

      {/* Hasta cuándo reserva, mientras está pendiente de envío: si vence, el
          sistema le quita los ítems (regla del 2026-10-27). */}
      {egreso && (
        <AvisoReserva egreso={egreso} cantidadItems={egreso.detalles.length} />
      )}
      {/* Con quién está el pedido y desde cuándo (2026-10-29). */}
      {egreso && <EsperaPedido egreso={egreso} />}

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
                pero lo que sale del almacén es esto. Los separa una raya, no un
                panel: con panel quedaban tres cajas una dentro de otra
                (formulario → panel → línea). Igual que en el de ingreso. */}
            <div className="border-t pt-4">
              <EgresoLineas
                control={control}
                disabled={ocupado}
                lotesIniciales={lotesIniciales}
              />
            </div>

            {/* Acción principal al pie del formulario — igual que el de
                ingresos. Queda al final de lo que hay que completar, no en la
                barra de arriba junto a las acciones del documento. */}
            {/* Dos salidas, al crear y al editar (pedido del usuario,
                2026-10-28): lo normal es armar o corregir el pedido y mandarlo
                de una, así que «Guardar y enviar» es la principal; «Guardar sin
                enviar» lo deja en manos del solicitante para terminarlo
                después. Las dos vuelven al listado. Un devuelto se «reenvía»:
                conserva su número. */}
            <div className="mt-2 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button type="submit" variant="outline" disabled={ocupado}>
                {ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar sin enviar
              </Button>
              <Button
                type="button"
                disabled={ocupado}
                onClick={handleSubmit(setParaEnviar, avisarInvalido)}
              >
                <Send className="size-4" />
                {estado === "DEVUELTO"
                  ? "Guardar y reenviar al aprobador"
                  : "Guardar y enviar al aprobador"}
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
              {/* Los dos pasos, en orden: primero las cantidades, después el
                  botón del pie. Es lo que no se entendía cuando la entrega
                  arrancaba con un botón «Entregar» arriba. */}
              {entregando && (
                <>
                  <div className="flex items-start gap-3 bg-primary/5 p-4 text-sm">
                    <PackageCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    <ol className="flex flex-col gap-1">
                      <li>
                        <span className="font-medium">
                          1. Revisá la cantidad a entregar de cada ítem.
                        </span>{" "}
                        <span className="text-muted-foreground">
                          Viene con lo pedido; si de algo hay menos en el
                          estante, bajala.
                        </span>
                      </li>
                      <li>
                        <span className="font-medium">
                          2. Tocá «Confirmar entrega», al pie.
                        </span>{" "}
                        <span className="text-muted-foreground">
                          Recién ahí se descuenta el stock y queda la salida en
                          el Kardex.
                        </span>
                      </li>
                    </ol>
                  </div>
                  <Separator />
                </>
              )}

              {/* Redondea solo las esquinas de ABAJO, y solo si la tabla es la
                  última sección: no es la primera, así que sus esquinas de
                  arriba van rectas — `rounded-[inherit]` (lo que usa `Table`
                  por default) tomaría las cuatro del borde exterior y dejaba
                  un par de puntas redondeadas sueltas a mitad de tarjeta. */}
              <div
                className={cn(
                  "overflow-hidden",
                  !puedeRechazar && "rounded-b-md"
                )}
              >
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
                      <TableHead className="text-right">
                        {entregando ? "A entregar" : "Entregado"}
                      </TableHead>
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
                          {/* Un lote llegado por traspaso no tiene ingreso
                              con número: su documento es el traspaso. */}
                          {detalle.ingresoDetalle.ingreso.traspaso && (
                            <span className="mr-1 text-xs text-muted-foreground">
                              Trasp.
                            </span>
                          )}
                          <NumeroDocumento
                            numero={
                              (
                                detalle.ingresoDetalle.ingreso.traspaso ??
                                detalle.ingresoDetalle.ingreso
                              ).numero
                            }
                            gestion={
                              (
                                detalle.ingresoDetalle.ingreso.traspaso ??
                                detalle.ingresoDetalle.ingreso
                              ).gestion
                            }
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
                              const texto = aEntregar(
                                detalle.id,
                                detalle.cantidadSolicitada
                              )
                              const valor = Number(texto)
                              const excedida = valor > pedido
                              const menos = !excedida && valor < pedido
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
                                    value={texto}
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
                                  {menos && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                      {cantidad(pedido - valor)} menos de lo
                                      pedido
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

              {/* La decisión al PIE, debajo de lo que se decide (pedido del
                  usuario, 2026-10-29): igual que Guardar y enviar en el
                  formulario. El principal a la derecha, Rechazar a su lado. */}
              {puedeRechazar && (
                <div className="flex flex-col-reverse justify-end gap-2 border-t p-4 sm:flex-row">
                  <Button
                    variant="destructive"
                    disabled={ocupado}
                    onClick={() => setAccionConMotivo("rechazar")}
                  >
                    <X className="size-4" />
                    Rechazar
                  </Button>
                  {puedeAprobar && (
                    <Button
                      disabled={ocupado}
                      onClick={() => void aprobar.mutateAsync(id as number)}
                    >
                      {aprobar.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Aprobar
                    </Button>
                  )}
                  {puedeEntregar && (
                    <Button
                      disabled={ocupado || excedidasEntrega.length > 0}
                      onClick={() => setConfirmandoEntrega(true)}
                    >
                      <PackageCheck className="size-4" />
                      Confirmar entrega
                    </Button>
                  )}
                </div>
              )}
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
      {paraEnviar && (
        <EnviarDialog
          reenvio={estado === "DEVUELTO"}
          guardarPedido={async () => {
            if (esNuevo)
              return (await crear.mutateAsync(aPayload(paraEnviar))).id
            await actualizar.mutateAsync({
              id: id as number,
              ...aPayloadEdicion(paraEnviar),
            })
            return id as number
          }}
          onEnviado={() => navigate("/egresos")}
          onGuardadoSinEnviar={() => {
            toast.info(
              "El pedido quedó guardado pero no se envió: corregilo y envialo desde el listado."
            )
            navigate("/egresos")
          }}
          onClose={() => setParaEnviar(null)}
        />
      )}

      {/* Entregar no tiene vuelta atrás salvo anulando, así que se confirma —
          y si algo sale con menos de lo pedido, se dice cuál. */}
      <AlertDialog
        open={confirmandoEntrega}
        onOpenChange={(abierto) => !abierto && setConfirmandoEntrega(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar la entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              Se descuenta del stock la cantidad «A entregar» de cada ítem y
              queda la salida en el Kardex. El pedido pasa a entregado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {reducidasEntrega.length > 0 ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium">Con menos de lo pedido:</p>
              <ul className="mt-1 list-disc pl-5">
                {reducidasEntrega.map((d) => (
                  <li key={d.id}>
                    {descripcionConNota(
                      d.ingresoDetalle.item.descripcion,
                      d.ingresoDetalle.observacion
                    )}
                    : {cantidad(aEntregar(d.id, d.cantidadSolicitada) || 0)} de{" "}
                    {cantidad(d.cantidadSolicitada)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Se entrega todo lo pedido.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={entregar.isPending}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={entregar.isPending}
              onClick={(event) => {
                // Sin esto el diálogo se cierra antes de que responda el backend.
                event.preventDefault()
                void confirmarEntrega()
              }}
            >
              {entregar.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Entregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={accionConMotivo !== null}
        onOpenChange={(abierto) => !abierto && setAccionConMotivo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {accionConMotivo === "rechazar"
                ? "¿Rechazar el pedido?"
                : accionConMotivo === "desistir"
                  ? "¿Desistir del pedido?"
                  : "¿Anular el egreso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {accionConMotivo === "rechazar"
                ? "Vuelve al solicitante para que lo corrija y lo envíe de nuevo. Conserva su número, y su material sigue reservado con un plazo nuevo para corregirlo."
                : accionConMotivo === "desistir"
                  ? "Queda cerrado sin entregarse y libera el material que tenía reservado. No se borra: ya tiene número, así que se conserva con su historial. No se puede volver a enviar."
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
              variant={
                accionConMotivo === "rechazar" ? "default" : "destructive"
              }
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
