import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  obtenerCuadros,
  obtenerGestionesCerradas,
} from "@/features/cierres/cierres.api"
import { getApiErrorMessage } from "@/lib/api"
import { abrirPestanaPdf, mostrarPdf } from "@/lib/pdf"

import type { QueryCuadros } from "@/features/cierres/cierres.types"
import type { NumeroCuadro } from "@/features/cierres/lib/cuadros"

export type FormatoCuadro = "pdf" | "excel"

export function useGestionesCerradas() {
  return useQuery({
    queryKey: ["cierres", "gestiones"],
    queryFn: obtenerGestionesCerradas,
  })
}

/**
 * Genera el Cuadro 5 o 6 en PDF (pestaña nueva, abierta dentro del gesto del
 * clic) o en Excel (descarga). Las librerías se cargan solo al usarlas.
 */
export function useCuadros() {
  const [generando, setGenerando] = useState<string | null>(null)

  async function generar(
    numero: NumeroCuadro,
    formato: FormatoCuadro,
    query: QueryCuadros
  ) {
    const ventana = formato === "pdf" ? abrirPestanaPdf() : null
    setGenerando(`${numero}-${formato}`)
    try {
      const datos = await obtenerCuadros(query)
      if (formato === "excel") {
        const { descargarCuadroExcel } =
          await import("@/features/cierres/lib/cuadros-excel")
        await descargarCuadroExcel(numero, datos)
      } else {
        const { crearCuadroPdf, nombreArchivoCuadroPdf } =
          await import("@/features/cierres/lib/cuadros-pdf")
        const documento = await crearCuadroPdf(numero, datos)
        await mostrarPdf(
          ventana,
          documento,
          nombreArchivoCuadroPdf(numero, datos)
        )
      }
    } catch (error) {
      ventana?.close()
      toast.error(
        getApiErrorMessage(error, `No se pudo generar el Cuadro ${numero}`)
      )
    } finally {
      setGenerando(null)
    }
  }

  return { generar, generando }
}
