import { useState } from "react"
import { toast } from "sonner"

import { obtenerIngreso } from "@/features/ingresos/ingresos.api"
import { etiquetaNumero } from "@/features/ingresos/ingresos.types"
import { useVisorPdf } from "@/hooks/use-visor-pdf"

import type { Ingreso } from "@/features/ingresos/ingresos.types"

/**
 * Genera la nota de ingreso en PDF y la deja lista para el visor embebido
 * (`PdfDialog`). Hermano de `useSolicitudPdf`.
 *
 * Lo usan el detalle (que ya tiene el ingreso completo) y el listado (que solo
 * tiene la fila liviana y necesita pedir el detalle antes, porque el documento
 * lleva las líneas, el NIT del proveedor y los cargos).
 */
export function useNotaIngreso() {
  /** Id del ingreso que se está generando, para el spinner de ESA fila. */
  const [generandoId, setGenerandoId] = useState<number | null>(null)
  const { pdf, mostrarPdf, cerrarPdf } = useVisorPdf()

  async function abrirNota(ingreso: Ingreso | number) {
    const id = typeof ingreso === "number" ? ingreso : ingreso.id
    setGenerandoId(id)
    try {
      const completo =
        typeof ingreso === "number" ? await obtenerIngreso(ingreso) : ingreso
      // pdfmake se carga sólo acá: no pesa en el bundle de quien no imprime.
      const { crearNotaIngresoPdf, nombreArchivo } = await import(
        "@/features/ingresos/lib/nota-ingreso-pdf"
      )
      const documento = await crearNotaIngresoPdf(completo)
      mostrarPdf(await documento.getBlob(), {
        nombre: nombreArchivo(completo),
        etiqueta: `Ingreso ${etiquetaNumero(completo)}`,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `No se pudo generar la nota: ${error.message}`
          : "No se pudo generar la nota de ingreso"
      )
    } finally {
      setGenerandoId(null)
    }
  }

  return { abrirNota, generandoId, pdf, cerrarPdf }
}
