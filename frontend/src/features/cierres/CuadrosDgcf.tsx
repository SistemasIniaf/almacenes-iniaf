import { useState } from "react"
import { ChevronDown, FileText, Loader2, Sheet } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCierres } from "@/features/cierres/useCierres"
import { useCuadros, useGestionesCerradas } from "@/features/cierres/useCuadros"

import type { NumeroCuadro } from "@/features/cierres/lib/cuadros"

const INSTITUCIONAL = "institucional"

const DESCRIPCION: Record<NumeroCuadro, string> = {
  5: "Resumen por partida",
  6: "Detalle por ítem y precio",
}

/**
 * Los Cuadros 5 y 6 de la DGCF, que salen de los cierres hechos. Son el MODELO
 * para llenar la planilla que manda el Ministerio: se eligen gestión y almacén
 * (o el institucional) y se bajan en PDF o en Excel.
 */
export function CuadrosDgcf() {
  const { data: gestiones = [], isPending } = useGestionesCerradas()
  const [gestionElegida, setGestionElegida] = useState<string | null>(null)
  const [alcance, setAlcance] = useState(INSTITUCIONAL)
  const { generar, generando } = useCuadros()

  // Sin elección, la gestión más reciente con cierres.
  const gestion =
    gestionElegida ?? (gestiones[0] ? String(gestiones[0].gestion) : null)

  // Los almacenes que cerraron esa gestión: solo esos tienen cuadro propio.
  const { data: cierres } = useCierres({
    gestion: gestion ? Number(gestion) : undefined,
    page: 1,
    pageSize: 100,
  })
  const almacenes = (gestion ? (cierres?.data ?? []) : [])
    .map((c) => c.almacen)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  if (isPending) return null

  if (gestiones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Se generan a partir de los cierres: todavía no se cerró ninguna gestión.
      </p>
    )
  }

  const query = {
    gestion: Number(gestion),
    ...(alcance === INSTITUCIONAL ? {} : { almacenId: Number(alcance) }),
  }

  const boton = (numero: NumeroCuadro) => {
    const ocupado = generando?.startsWith(`${numero}-`)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={generando != null}>
            {ocupado ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Cuadro {numero}
            <span className="hidden text-muted-foreground sm:inline">
              · {DESCRIPCION[numero]}
            </span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => void generar(numero, "pdf", query)}>
            <FileText className="size-4" />
            <div>
              <div className="font-medium">PDF</div>
              <div className="text-xs text-muted-foreground">
                Para revisar e imprimir.
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void generar(numero, "excel", query)}
          >
            <Sheet className="size-4" />
            <div>
              <div className="font-medium">Excel</div>
              <div className="text-xs text-muted-foreground">
                Mismas columnas que la planilla del Ministerio.
              </div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          value={gestion ?? undefined}
          onValueChange={(v) => {
            setGestionElegida(v)
            setAlcance(INSTITUCIONAL)
          }}
        >
          <SelectTrigger className="sm:w-48" aria-label="Gestión">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {gestiones.map((g) => (
              <SelectItem key={g.gestion} value={String(g.gestion)}>
                Gestión {g.gestion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={alcance} onValueChange={setAlcance}>
          <SelectTrigger className="sm:w-96" aria-label="Almacén">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value={INSTITUCIONAL}>
              Institucional (todos los almacenes)
            </SelectItem>
            {almacenes.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        {boton(5)}
        {boton(6)}
      </div>
      <p className="text-xs text-muted-foreground">
        Salen de los saldos guardados en cada cierre. El institucional suma los
        almacenes que ya cerraron, descuenta los traspasos entre ellos y dice
        PROVISIONAL mientras falte cerrar alguno.
      </p>
    </div>
  )
}
