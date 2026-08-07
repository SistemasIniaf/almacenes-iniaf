import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Ban, FileText, Loader2, Save } from "lucide-react"
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
import { BadgeEstado } from "@/components/data/BadgeEstado"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { DatePickerField } from "@/components/form/DatePickerField"
import { InputField } from "@/components/form/InputField"
import { SelectField } from "@/components/form/SelectField"
import { TextareaField } from "@/components/form/TextareaField"
import { ComboboxField } from "@/components/form/ComboboxField"
import { useAlmacenesActivos } from "@/features/almacenes/useAlmacenes"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useFuentesActivas } from "@/features/fuentes-financiamiento/useFuentesFinanciamiento"
import { useProveedoresActivos } from "@/features/proveedores/useProveedores"
import { IngresoLineas } from "@/features/ingresos/components/IngresoLineas"
import {
  useActualizarIngreso,
  useAnularIngreso,
  useCrearIngreso,
  useImagenLote,
  useIngreso,
  useSolicitadores,
  useUnidadesDeAlmacen,
} from "@/features/ingresos/hooks/useIngresos"
import { useNotaIngreso } from "@/features/ingresos/hooks/useNotaIngreso"
import { subirImagenLote } from "@/features/ingresos/ingresos.api"
import {
  aPayload,
  aPayloadEdicion,
  desdeIngreso,
  ingresoSchema,
  VALORES_INICIALES,
} from "@/features/ingresos/ingresos.schema"
import {
  ESTADO_LABEL,
  ESTADO_PUNTO,
  etiquetaNumero,
} from "@/features/ingresos/ingresos.types"

import type { ComboboxOption } from "@/components/form/ComboboxField"
import type { FotoDeLote } from "@/features/ingresos/components/IngresoLineas"
import type { IngresoFormValues } from "@/features/ingresos/ingresos.schema"
import type { Ingreso } from "@/features/ingresos/ingresos.types"

/**
 * Agrega al selector lo que el ingreso YA referencia, si el catálogo activo no
 * lo trae. Pasa cuando la persona o el proveedor se dieron de baja DESPUÉS de
 * registrar el ingreso: sin esto el campo se ve vacío y parece que se perdió el
 * dato.
 *
 * La regla: los catálogos filtran activos para lo NUEVO, pero un documento ya
 * emitido conserva su referencia. El backend la acompaña — al editar solo valida
 * el responsable si CAMBIA (ver `ingresos.service.ts`).
 *
 * No hace falta pedir nada extra: el propio ingreso trae el nombre.
 */
function conReferenciaActual(
  opciones: ComboboxOption[],
  actual: { id: number; nombre: string } | null | undefined
): ComboboxOption[] {
  if (!actual || opciones.some((o) => o.value === String(actual.id))) {
    return opciones
  }
  return [
    { value: String(actual.id), label: `${actual.nombre} (inactivo)` },
    ...opciones,
  ]
}

export function IngresoFormPage() {
  const { id: idParam } = useParams()
  const id = idParam ? Number(idParam) : undefined
  const esNuevo = id == null
  const navigate = useNavigate()
  const { user } = useAuth()
  const esResponsable = user?.rol === "responsable_almacen"
  const esSuperAdmin = user?.rol === "super_admin"

  const { data: ingreso, isPending: cargando } = useIngreso(id)
  const crear = useCrearIngreso()
  const actualizar = useActualizarIngreso()
  const anular = useAnularIngreso()
  const imagenLote = useImagenLote()

  const [dialogoAnular, setDialogoAnular] = useState(false)
  const [motivo, setMotivo] = useState("")
  const { abrirNota, generandoId } = useNotaIngreso()

  /**
   * Fotos de lote cambiadas en ESTA sesión, por id de línea.
   *
   * Existe porque la mutación no invalida el detalle del ingreso: si lo hiciera,
   * el refetch dispararía el `reset()` de abajo y se perdería lo que el usuario
   * estuviera escribiendo en la cabecera. Así que la foto recién subida se pisa
   * acá y el resto del formulario no se entera. Es el mismo recurso que usa
   * `ItemFormDialog`, adaptado a que acá hay varias fotos por pantalla.
   */
  const [fotosCambiadas, setFotosCambiadas] = useState<Map<number, string | null>>(
    () => new Map()
  )

  const { control, handleSubmit, reset, watch } = useForm<IngresoFormValues>({
    resolver: zodResolver(ingresoSchema),
    defaultValues: VALORES_INICIALES,
  })

  // Carga inicial: nuevo (preseteando el almacén del responsable) o existente.
  useEffect(() => {
    if (esNuevo) {
      reset({
        ...VALORES_INICIALES,
        almacenId:
          esResponsable && user?.almacenId ? String(user.almacenId) : "",
      })
    } else if (ingreso) {
      reset(desdeIngreso(ingreso))
    }
  }, [esNuevo, ingreso, esResponsable, user?.almacenId, reset])

  const estado = ingreso?.estado
  const anulado = !esNuevo && estado === "ANULADO"
  // Los campos que tocan stock / correlativo (líneas, fecha de remisión, fuente,
  // almacén) se editan SOLO al crear; registrado el ingreso, quedan fijos.
  const bloqueoStock = !esNuevo
  // La cabecera documental (factura, respaldos, proveedor, solicitante, unidad)
  // se puede editar mientras el ingreso esté vigente (no anulado).
  const bloqueoCabecera = anulado
  // La fecha de ingreso arrastra gestión, correlativo y Kardex: la corrige solo
  // el super_admin (el backend responde 403 a cualquier otro rol).
  const puedeCorregirFecha = !esNuevo && esSuperAdmin && !anulado
  const guardando = crear.isPending || actualizar.isPending

  const almacenIdSel = watch("almacenId")
  const almacenNum = almacenIdSel ? Number(almacenIdSel) : undefined

  const { data: almacenes = [] } = useAlmacenesActivos()
  const { data: proveedores = [] } = useProveedoresActivos()
  const { data: fuentes = [] } = useFuentesActivas()
  const { data: solicitadores = [] } = useSolicitadores()
  const { data: unidades = [] } = useUnidadesDeAlmacen(almacenNum)

  // El responsable no elige almacén (usa el suyo); admin sí, solo al crear.
  const almacenEditable = esNuevo && !esResponsable
  // Nombre a mostrar cuando el almacén no es editable (en vez del id).
  const nombreAlmacen =
    ingreso?.almacen.nombre ??
    almacenes.find((a) => String(a.id) === almacenIdSel)?.nombre ??
    ""

  /** Sube o quita la foto de un lote ya registrado y la refleja al instante. */
  function aplicarFoto(detalleId: number, archivo: File | null) {
    imagenLote.mutate(
      { ingresoId: id as number, detalleId, archivo },
      {
        onSuccess: (actualizado) => {
          const lote = actualizado.detalles.find((d) => d.id === detalleId)
          setFotosCambiadas((previas) =>
            new Map(previas).set(detalleId, lote?.imagenUrl ?? null)
          )
        },
      }
    )
  }

  /**
   * Handlers de la foto por línea. Solo al EDITAR: ahí el lote ya tiene id y la
   * subida es inmediata. Al crear se deja en `undefined` y el `ImageField` pasa
   * a guardar el archivo en el formulario (ver `FotoDeLinea`).
   */
  const fotoDeLote: FotoDeLote | undefined = esNuevo
    ? undefined
    : {
        urlDe: (detalleId) =>
          fotosCambiadas.has(detalleId)
            ? (fotosCambiadas.get(detalleId) ?? null)
            : (ingreso?.detalles.find((d) => d.id === detalleId)?.imagenUrl ??
              null),
        onSubir: (detalleId, archivo) => aplicarFoto(detalleId, archivo),
        onQuitar: (detalleId) => aplicarFoto(detalleId, null),
        enCurso: imagenLote.isPending
          ? (imagenLote.variables?.detalleId ?? null)
          : null,
        bloqueada: anulado,
      }

  /**
   * Sube las fotos que se eligieron antes de que las líneas existieran.
   *
   * El emparejamiento es POSICIONAL y no puede ser otra cosa: el id del lote
   * nace dentro de la transacción del POST, así que no hay nada con qué
   * relacionarlos de antemano. Funciona porque el backend crea los lotes en el
   * orden en que vienen las líneas y `ingresoFullSelect` los devuelve
   * `orderBy: { id: 'asc' }` — la i-ésima línea del formulario es el i-ésimo
   * detalle del ingreso creado.
   *
   * Un fallo acá NO pierde el ingreso, que ya quedó registrado con su número y
   * su Kardex: se avisa qué fotos faltaron y se cargan desde la edición, donde
   * reintentarlo es un clic. Por eso tampoco se corta en el primer error.
   */
  async function subirFotosPendientes(creado: Ingreso, v: IngresoFormValues) {
    const pendientes = v.detalles.flatMap((linea, i) => {
      const detalle = creado.detalles[i]
      return linea.archivo && detalle ? [{ archivo: linea.archivo, detalle }] : []
    })
    if (pendientes.length === 0) return

    const fallidas: string[] = []
    for (const { archivo, detalle } of pendientes) {
      try {
        await subirImagenLote(creado.id, detalle.id, archivo)
      } catch {
        fallidas.push(detalle.item.descripcion)
      }
    }

    if (fallidas.length > 0) {
      toast.warning(
        `El ingreso se registró, pero no se pudo subir la foto de ${fallidas.join(", ")}. Cargala desde el ingreso.`
      )
    }
  }

  async function guardar(v: IngresoFormValues) {
    try {
      if (esNuevo) {
        // Registro definitivo: el backend estampa número, crea lotes y Kardex.
        const creado = await crear.mutateAsync(
          aPayload(v, { incluirAlmacen: !esResponsable })
        )
        // Recién ahora las líneas tienen id: las fotos van en un segundo paso.
        await subirFotosPendientes(creado, v)
        navigate(`/ingresos/${creado.id}`)
      } else {
        // Edición: solo la cabecera documental (no toca líneas ni stock).
        await actualizar.mutateAsync({
          id: id as number,
          ...aPayloadEdicion(v, { incluirFecha: puedeCorregirFecha }),
        })
      }
    } catch {
      // toast lo emite la mutación (lista lo que falta al registrar)
    }
  }

  async function handleAnular() {
    try {
      await anular.mutateAsync({ id: id as number, motivo: motivo.trim() })
      setDialogoAnular(false)
      setMotivo("")
    } catch {
      /* toast en la mutación */
    }
  }

  if (!esNuevo && cargando) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => navigate("/ingresos")}
            aria-label="Volver"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {esNuevo
                ? "Nuevo ingreso"
                : `Ingreso ${etiquetaNumero(ingreso ?? { numero: null, gestion: null })}`}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {!esNuevo && estado && (
                <BadgeEstado tono={ESTADO_PUNTO[estado]}>
                  {ESTADO_LABEL[estado]}
                </BadgeEstado>
              )}
              {/* El almacén se muestra acá y no como campo del formulario:
                  salvo que un admin lo esté eligiendo, es un dato fijo. */}
              {nombreAlmacen && <span>{nombreAlmacen}</span>}
            </div>
          </div>
        </div>

        {/* Acciones del ingreso YA existente (a nivel documento). El botón de
            registrar/guardar del formulario va en la barra fija de abajo. */}
        <div className="flex gap-2">
          {!esNuevo && (
            <Button
              type="button"
              variant="outline"
              onClick={() => ingreso && abrirNota(ingreso)}
              disabled={generandoId != null}
            >
              {/* Mismo icono que en el listado. Acá NO va en rojo: dentro de un
                  botón con texto, el rojo se lee como acción peligrosa. */}
              {generandoId != null ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Ver PDF
            </Button>
          )}
          {estado === "CONFIRMADO" && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDialogoAnular(true)}
            >
              <Ban className="size-4" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {estado === "ANULADO" && ingreso?.motivoAnulacion && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span className="font-medium">Anulado:</span>{" "}
          {ingreso.motivoAnulacion}
        </div>
      )}

      {!esNuevo && estado === "CONFIRMADO" && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Este ingreso ya impactó el stock. Solo se edita la cabecera (factura,
          respaldos, proveedor, solicitante y unidad). Para corregir ítems,
          cantidades, precios, fuente o la fecha de remisión, anulá el ingreso y
          registralo de nuevo.
        </div>
      )}

      <form id="ingreso-form" onSubmit={handleSubmit(guardar)}>
        <div className="rounded-md border p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
            {/*
              1. Almacén — SOLO cuando un admin crea el ingreso y tiene que
              elegir a cuál entra. Para el responsable es siempre el suyo, así
              que no se pide: el nombre figura en el encabezado de la página.
            */}
            {almacenEditable && (
              <>
                <div className="lg:col-span-4">
                  <SelectField
                    name="almacenId"
                    label="Almacén"
                    control={control}
                    options={almacenes.map((a) => ({
                      value: String(a.id),
                      label: a.nombre,
                    }))}
                    placeholder="Elegí el almacén"
                    disabled={bloqueoCabecera}
                  />
                </div>
                {/*
                  Relleno para que el almacén ocupe su propia línea y las filas
                  de abajo sigan cerrando en 12 tal cual las ordenaste. Sin esto,
                  con el admin la primera fila suma 17 (4+3+2+2+6) y el proveedor
                  se cae de línea arrastrando todo el resto. Solo desde lg: más
                  abajo la grilla es de 1 o 2 columnas y una celda vacía se vería.
                */}
                <div className="hidden lg:col-span-8 lg:block" aria-hidden />
              </>
            )}

            {/*
              1-bis. Fecha de ingreso. No se pide al crear: la estampa el
              backend con el momento del registro, justamente para que nadie la
              tipee. Al editar se muestra siempre, y solo el super_admin puede
              corregirla. Ocupa su propia línea (mismo truco de relleno que el
              almacén) para no descuadrar la suma de 12 de las filas de abajo.
            */}
            {!esNuevo && (
              <>
                <div className="lg:col-span-3">
                  <DatePickerField
                    name="fechaIngreso"
                    label="Fecha de ingreso"
                    control={control}
                    required={false}
                    placeholder="—"
                    disabled={!puedeCorregirFecha}
                    description={
                      puedeCorregirFecha
                        ? "Gobierna la gestión, el correlativo y el Kardex. Si la corrección cae en otra gestión, el número del ingreso cambia."
                        : "La asigna el sistema al registrar el ingreso."
                    }
                  />
                </div>
                <div className="hidden lg:col-span-9 lg:block" aria-hidden />
              </>
            )}

            {/* 2. Fecha de remisión (¼) */}
            <div className="lg:col-span-3">
              <DatePickerField
                name="fechaRemision"
                label="Fecha de remisión"
                control={control}
                required
                placeholder="Elija la fecha"
                disabled={bloqueoStock}
              />
            </div>

            {/* 3. Nota de remisión (¼) */}
            <div className="lg:col-span-2">
              <InputField
                name="notaRemision"
                label="Nota de remisión"
                control={control}
                required
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 4. Nº de factura (¼) */}
            <div className="lg:col-span-2">
              <InputField
                name="numeroFactura"
                label="Nº de factura"
                control={control}
                required={false}
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 5. Proveedor — cierra la fila: 3+2+2+5 = 12. */}
            <div className="lg:col-span-5">
              <ComboboxField
                name="proveedorId"
                label="Proveedor"
                control={control}
                required
                options={conReferenciaActual(
                  proveedores.map((p) => ({
                    value: String(p.id),
                    label: p.nombre,
                  })),
                  ingreso?.proveedor
                )}
                placeholder="Elegí un proveedor"
                vacio="Ningún proveedor coincide."
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 10. Fecha del informe / acta (¼) */}
            <div className="lg:col-span-3">
              <DatePickerField
                name="fechaInformeConformidad"
                label="Fecha del informe/acta"
                control={control}
                required
                placeholder="Elija la fecha"
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 9. Informe / acta de conformidad (¼) */}
            <div className="lg:col-span-3">
              <InputField
                name="informeConformidad"
                label="Informe/acta de conformidad"
                control={control}
                required
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 11. Responsable / Comisión de recepción (¼) */}
            <div className="lg:col-span-6">
              <ComboboxField
                name="responsableConformidadId"
                label="Responsable / Comisión de recepción"
                control={control}
                required
                options={conReferenciaActual(
                  solicitadores.map((u) => ({
                    value: String(u.id),
                    label: u.nombre,
                    busqueda: u.usuario,
                  })),
                  ingreso?.responsableConformidad
                )}
                placeholder="Elegí un solicitador"
                vacio="Ningún solicitador coincide."
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 12. Unidad solicitante (½) */}
            <div className="lg:col-span-4">
              <ComboboxField
                name="unidadSolicitanteId"
                label="Unidad solicitante"
                control={control}
                required
                options={unidades.map((u) => ({
                  value: String(u.id),
                  label: u.nombre,
                  busqueda: u.sigla,
                }))}
                placeholder={
                  almacenNum ? "Elegí una unidad" : "Elegí primero el almacén"
                }
                vacio="Ninguna unidad coincide."
                disabled={bloqueoCabecera || !almacenNum}
              />
            </div>

            {/* 6. Proceso Nº / C31 (¼) */}
            <div className="lg:col-span-2">
              <InputField
                name="procesoC31"
                label="Proceso Nº / C31"
                control={control}
                required
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 7. Certificación (¼) — la puse junto a los otros nº de documento. Decime si va en otro lado. */}
            <div className="lg:col-span-2">
              <InputField
                name="certificacion"
                label="Certificación"
                control={control}
                required
                disabled={bloqueoCabecera}
              />
            </div>

            {/* 8. Fuente de financiamiento (½) */}
            <div className="lg:col-span-4">
              <ComboboxField
                name="fuenteFinanciamientoId"
                label="Fuente de financiamiento"
                control={control}
                required
                options={fuentes.map((f) => ({
                  value: String(f.id),
                  label: f.nombre,
                }))}
                placeholder="Elegí una fuente"
                vacio="Ninguna fuente coincide."
                disabled={bloqueoStock}
              />
            </div>

            {/* 13. Observación (ancho completo) */}
            <div className="md:col-span-2 lg:col-span-12">
              <TextareaField
                name="observacion"
                label="Observación"
                control={control}
                required={false}
                rows={2}
                disabled={bloqueoCabecera}
              />
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <IngresoLineas
              control={control}
              disabled={bloqueoStock}
              // El selector de ítems busca contra el servidor: los ítems que ya
              // tiene el ingreso viajan aparte para que se vean sin buscarlos.
              itemsIniciales={ingreso?.detalles.map((d) => d.item) ?? []}
              // La foto es la ÚNICA parte de la línea que sigue editable con el
              // ingreso registrado: no mueve saldo ni correlativo.
              foto={fotoDeLote}
            />
          </div>

          {/* Acción principal al pie del formulario, dentro del card. Un ingreso
              anulado ya no se edita, así que no lleva botón. */}
          {!anulado && (
            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={guardando}>
                {guardando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {esNuevo ? "Registrar ingreso" : "Guardar cambios"}
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* Diálogo de anulación */}
      <AlertDialog open={dialogoAnular} onOpenChange={setDialogoAnular}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este ingreso?</AlertDialogTitle>
            <AlertDialogDescription>
              Revierte el material del stock (movimiento de reversión en el
              Kardex) y queda registrado quién, cuándo y por qué. No se elimina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo de la anulación..."
              rows={3}
            />
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anular.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={anular.isPending || motivo.trim() === ""}
              onClick={(e) => {
                e.preventDefault()
                void handleAnular()
              }}
            >
              Anular ingreso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      
    </div>
  )
}
