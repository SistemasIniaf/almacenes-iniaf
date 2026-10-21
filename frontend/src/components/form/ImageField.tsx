import { useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2, ZoomIn } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { MIME_IMAGEN_PERMITIDOS, urlArchivo, validarImagen } from "@/lib/files"
import { cn } from "@/lib/utils"

interface ImageFieldProps {
  label: string
  /** Ruta relativa guardada en la DB (ej. "/uploads/items/3-ab12cd34.webp"). */
  imagenUrl: string | null
  /**
   * Archivo elegido que TODAVIA no se subio (modo creacion: el endpoint de
   * imagen necesita el id, que recien existe despues del POST). Tiene prioridad
   * sobre `imagenUrl` para el preview.
   */
  archivoPendiente?: File | null
  onSeleccionar: (archivo: File) => void
  onQuitar: () => void
  procesando?: boolean
  disabled?: boolean
  description?: string
  /**
   * Alto del recuadro de la imagen (clases de Tailwind). Por defecto `h-52`;
   * en un formulario a dos columnas conviene más alto, para llenar la columna.
   */
  altoPreview?: string
}

/**
 * Subida de imagen con preview GRANDE. Funciona en dos modos:
 * - **edicion**: recibe `imagenUrl` y los callbacks disparan los endpoints al
 *   instante (`POST/DELETE /items/:id/imagen`);
 * - **creacion**: recibe `archivoPendiente` y los callbacks solo guardan el
 *   archivo en el formulario; la subida ocurre despues de crear el registro.
 *
 * El preview ocupa todo el ancho y muestra la imagen ENTERA sobre blanco
 * (2026-10-20, pedido del usuario): era un cuadrado de 96 px recortado, y en un
 * ítem alargado —un bolígrafo— no se distinguía nada. Clic sobre la imagen la
 * amplía; sin imagen, el recuadro es la zona para elegirla o ARRASTRARLA.
 *
 * OJO: no es un campo de react-hook-form como el resto de los `*Field` — no
 * recibe `control`/`name`, sino el valor actual y dos callbacks.
 */
export function ImageField({
  label,
  imagenUrl,
  archivoPendiente = null,
  onSeleccionar,
  onQuitar,
  procesando = false,
  disabled = false,
  description,
  altoPreview = "h-52",
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [ampliada, setAmpliada] = useState(false)

  // Preview del archivo local. Se crea con useMemo y se libera en el cleanup
  // del efecto: sin el revoke, cada archivo elegido queda retenido en memoria.
  const previewLocal = useMemo(
    () => (archivoPendiente ? URL.createObjectURL(archivoPendiente) : null),
    [archivoPendiente]
  )

  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal)
    }
  }, [previewLocal])

  const src = previewLocal ?? urlArchivo(imagenUrl)
  const bloqueado = disabled || procesando

  function elegir(archivo: File | undefined) {
    if (!archivo) return
    const problema = validarImagen(archivo)
    setError(problema)
    if (!problema) onSeleccionar(archivo)
  }

  function alElegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    // Permite volver a elegir el MISMO archivo despues de un error.
    evento.target.value = ""
    elegir(archivo)
  }

  // Arrastrar y soltar: vale tanto con el recuadro vacío como sobre una imagen
  // ya cargada (la reemplaza), igual que el botón «Reemplazar».
  const propsArrastre = bloqueado
    ? {}
    : {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault()
          setArrastrando(true)
        },
        onDragLeave: () => setArrastrando(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          setArrastrando(false)
          elegir(e.dataTransfer.files?.[0])
        },
      }

  const abrirSelector = () => inputRef.current?.click()

  return (
    <Field className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={MIME_IMAGEN_PERMITIDOS.join(",")}
        onChange={alElegirArchivo}
        className="hidden"
      />

      {/* Un solo botón que cambia de acción: con imagen la AMPLÍA, sin imagen
          abre el selector. Es lo que el ojo espera de cada estado. */}
      <button
        type="button"
        onClick={src ? () => setAmpliada(true) : abrirSelector}
        disabled={procesando || (!src && disabled)}
        aria-label={src ? `Ampliar ${label.toLowerCase()}` : "Elegir imagen"}
        className={cn(
          "group relative flex w-full items-center justify-center overflow-hidden rounded-md border p-3 transition-colors",
          // Blanco fijo con imagen: la foto se ve igual en los dos temas y
          // como va a salir. Sin imagen, zona punteada para soltar.
          altoPreview,
          src
            ? "cursor-zoom-in bg-white"
            : "border-dashed bg-muted/40 hover:bg-muted/70 disabled:cursor-not-allowed disabled:hover:bg-muted/40",
          arrastrando && "border-primary bg-primary/5 ring-2 ring-primary/30"
        )}
        {...propsArrastre}
      >
        {procesando ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        ) : src ? (
          <>
            <img
              src={src}
              alt={label}
              className="max-h-full max-w-full object-contain"
            />
            <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="size-3.5" />
              Ampliar
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <ImagePlus className="size-8" />
            {arrastrando ? (
              "Soltá la imagen acá"
            ) : (
              <>
                Hacé clic o arrastrá una imagen acá
                <span className="text-xs">JPG, PNG o WebP. Máx. 5 MB.</span>
              </>
            )}
          </span>
        )}
      </button>

      {src && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={abrirSelector}
            disabled={bloqueado}
          >
            <ImagePlus className="size-4" />
            Reemplazar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null)
              onQuitar()
            }}
            disabled={bloqueado}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
            Quitar
          </Button>
          <span className="text-xs text-muted-foreground">
            JPG, PNG o WebP. Máx. 5 MB.
          </span>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {src && (
        <Dialog open={ampliada} onOpenChange={setAmpliada}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>
                {archivoPendiente
                  ? "Vista previa: se sube al crear el ítem."
                  : "Imagen guardada."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center rounded border bg-white p-2">
              <img
                src={src}
                alt={label}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Field>
  )
}
