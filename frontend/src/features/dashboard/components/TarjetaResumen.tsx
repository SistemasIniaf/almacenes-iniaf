import { Link } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import type { LucideIcon } from "lucide-react"

/**
 * Color de cada tarjeta según lo que cuenta (2026-11-18, pedido del usuario:
 * en oscuro las cuatro eran del mismo gris que la página). Es un TINTE, no un
 * relleno: degradé suave desde la esquina, borde del mismo color y el ícono en
 * un círculo. Clases escritas enteras porque Tailwind no ve las armadas.
 */
const TONOS = {
  ambar: {
    fondo: "from-amber-500/25",
    borde: "border-amber-500/50",
    icono: "bg-amber-500/25 text-amber-600 dark:text-amber-400",
  },
  azul: {
    fondo: "from-sky-500/25",
    borde: "border-sky-500/50",
    icono: "bg-sky-500/25 text-sky-600 dark:text-sky-400",
  },
  verde: {
    fondo: "from-emerald-500/25",
    borde: "border-emerald-500/50",
    icono: "bg-emerald-500/25 text-emerald-600 dark:text-emerald-400",
  },
  violeta: {
    fondo: "from-violet-500/25",
    borde: "border-violet-500/50",
    icono: "bg-violet-500/25 text-violet-600 dark:text-violet-400",
  },
  gris: {
    fondo: "from-slate-500/25",
    borde: "border-slate-500/50",
    icono: "bg-slate-500/25 text-slate-600 dark:text-slate-300",
  },
  rojo: {
    fondo: "from-rose-500/25",
    borde: "border-rose-500/50",
    icono: "bg-rose-500/25 text-rose-600 dark:text-rose-400",
  },
} as const

export type TonoTarjeta = keyof typeof TONOS

interface TarjetaResumenProps {
  titulo: string
  valor: number | undefined
  cargando: boolean
  /** Qué significa el número, en una línea. */
  detalle: string
  /** A dónde lleva la tarjeta entera (es un enlace). */
  a: string
  icono: LucideIcon
  /**
   * `true` en la tarjeta que exige una acción de este usuario. Solo se resalta
   * si además hay algo que hacer: en cero es una tarjeta más y teñirla sería
   * pedir atención por nada.
   */
  urgente?: boolean
  tono?: TonoTarjeta
}

export function TarjetaResumen({
  titulo,
  valor,
  cargando,
  detalle,
  a,
  icono: Icono,
  urgente = false,
  tono = "gris",
}: TarjetaResumenProps) {
  const resaltar = urgente && (valor ?? 0) > 0
  const colores = TONOS[tono]

  return (
    <Card
      className={cn(
        "gap-3 bg-gradient-to-br to-card to-80% transition-[filter] hover:brightness-95 dark:hover:brightness-125",
        colores.fondo,
        colores.borde,
        // Lo que espera una acción de este usuario se marca con un anillo.
        resaltar && "ring-2 ring-amber-500/60"
      )}
    >
      <Link to={a} className="contents">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              colores.icono
            )}
          >
            <Icono className="size-4" />
          </span>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-3xl font-semibold tabular-nums">
              {valor ?? "—"}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
        </CardContent>
      </Link>
    </Card>
  )
}
