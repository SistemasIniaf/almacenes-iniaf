import { useState } from "react"
import { toast } from "sonner"

import { obtenerIngreso } from "@/features/ingresos/ingresos.api"

import type { Ingreso } from "@/features/ingresos/ingresos.types"

/**
 * Abre la nota de ingreso en PDF, en una pestaña con el visor del navegador.
 *
 * Lo usan el detalle (que ya tiene el ingreso completo) y el listado (que solo
 * tiene la fila liviana y necesita pedir el detalle antes, porque el documento
 * lleva las líneas, el NIT del proveedor y los cargos).
 */
export function useNotaIngreso() {
  /** Id del ingreso que se está generando, para el spinner de ESA fila. */
  const [generandoId, setGenerandoId] = useState<number | null>(null)

  async function abrirNota(ingreso: Ingreso | number) {
    const id = typeof ingreso === "number" ? ingreso : ingreso.id
    // La pestaña se abre AHORA, dentro del gesto del clic. Si se abriera al
    // terminar de generar el PDF, el navegador la bloquearía como emergente.
    const ventana = window.open("", "_blank")
    setGenerandoId(id)
    try {
      const completo =
        typeof ingreso === "number" ? await obtenerIngreso(ingreso) : ingreso
      // pdfmake se carga sólo acá: no pesa en el bundle de quien no imprime.
      const { crearNotaIngresoPdf, nombreArchivo } = await import(
        "@/features/ingresos/lib/nota-ingreso-pdf"
      )
      const pdf = await crearNotaIngresoPdf(completo)
      // Si el navegador igual bloqueó la pestaña, se descarga el archivo.
      if (ventana) await pdf.open(ventana)
      else await pdf.download(nombreArchivo(completo))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar la nota: ${error.message}`
          : "No se pudo generar la nota de ingreso"
      )
    } finally {
      setGenerandoId(null)
    }
  }

  return { abrirNota, generandoId }
}
