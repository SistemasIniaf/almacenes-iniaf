import { useState } from "react"
import { toast } from "sonner"

import { obtenerTraspaso } from "@/features/traspasos/traspasos.api"
import { abrirPestanaPdf, mostrarPdf } from "@/lib/pdf"

import type { Traspaso } from "@/features/traspasos/traspasos.types"

/**
 * Genera la nota de traspaso en PDF y la abre en una PESTAÑA nueva — mismo
 * patrón que `useNotaIngreso`: la pestaña se abre dentro del gesto del clic,
 * antes de cualquier `await`, o el navegador la bloquea como emergente.
 */
export function useNotaTraspaso() {
  const [generandoId, setGenerandoId] = useState<number | null>(null)

  async function abrirNota(traspaso: Traspaso | number) {
    const id = typeof traspaso === "number" ? traspaso : traspaso.id
    const ventana = abrirPestanaPdf()
    setGenerandoId(id)
    try {
      const completo =
        typeof traspaso === "number"
          ? await obtenerTraspaso(traspaso)
          : traspaso
      const { crearNotaTraspasoPdf, nombreArchivo } =
        await import("@/features/traspasos/lib/nota-traspaso-pdf")
      const documento = await crearNotaTraspasoPdf(completo)
      await mostrarPdf(ventana, documento, nombreArchivo(completo))
    } catch (error) {
      ventana?.close()
      toast.error(
        error instanceof Error
          ? `No se pudo generar la nota: ${error.message}`
          : "No se pudo generar la nota de traspaso"
      )
    } finally {
      setGenerandoId(null)
    }
  }

  return { abrirNota, generandoId }
}
