import { useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  MIME_IMAGEN_PERMITIDOS,
  urlArchivo,
  validarImagen,
} from "@/lib/files"

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
}

/**
 * Subida de imagen con preview. Funciona en dos modos:
 * - **edicion**: recibe `imagenUrl` y los callbacks disparan los endpoints al
 *   instante (`POST/DELETE /items/:id/imagen`);
 * - **creacion**: recibe `archivoPendiente` y los callbacks solo guardan el
 *   archivo en el formulario; la subida ocurre despues de crear el registro.
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
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

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

  function alElegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    // Permite volver a elegir el MISMO archivo despues de un error.
    evento.target.value = ""
    if (!archivo) return

    const problema = validarImagen(archivo)
    setError(problema)
    if (!problema) onSeleccionar(archivo)
  }

  return (
    <Field className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div className="flex items-start gap-3">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {procesando ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : src ? (
            <img
              src={src}
              alt={label}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={MIME_IMAGEN_PERMITIDOS.join(",")}
            onChange={alElegirArchivo}
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || procesando}
          >
            <ImagePlus className="size-4" />
            {src ? "Reemplazar" : "Subir imagen"}
          </Button>

          {src && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null)
                onQuitar()
              }}
              disabled={disabled || procesando}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            JPG, PNG o WebP. Máx. 5 MB.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </Field>
  )
}
