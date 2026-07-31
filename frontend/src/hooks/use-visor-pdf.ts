import { useState } from "react"

/** Lo que el visor (`PdfDialog`) necesita para mostrar un PDF ya generado. */
export interface PdfAbierto {
  /** Object URL del blob. */
  url: string
  /** Nombre con el que se descarga (`nota-ingreso-003-2026.pdf`). */
  nombre: string
  /** Identificación del documento para el encabezado (`003/2026`). */
  etiqueta: string
}

/**
 * Estado del visor de PDF embebido, compartido por la nota de ingreso y la
 * solicitud de materiales.
 *
 * Existe para que la gestión del **object URL** viva en un solo lugar: cada PDF
 * generado reserva memoria hasta que se lo revoca, y ese es justo el detalle que
 * se olvida al copiar el patrón a un módulo nuevo.
 */
export function useVisorPdf() {
  const [pdf, setPdf] = useState<PdfAbierto | null>(null)

  function mostrarPdf(blob: Blob, datos: Omit<PdfAbierto, "url">) {
    setPdf({ url: URL.createObjectURL(blob), ...datos })
  }

  function cerrarPdf() {
    setPdf((abierto) => {
      if (abierto) URL.revokeObjectURL(abierto.url)
      return null
    })
  }

  return { pdf, mostrarPdf, cerrarPdf }
}
