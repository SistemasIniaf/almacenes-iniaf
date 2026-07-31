import {
  Ban,
  Check,
  ChevronUp,
  FilePlus,
  PackageCheck,
  Send,
  X,
} from "lucide-react"

import { describirPaso } from "@/features/egresos/egresos.types"
import { cn } from "@/lib/utils"

import type { LucideIcon } from "lucide-react"
import type {
  EgresoHistorial,
  EstadoEgreso,
} from "@/features/egresos/egresos.types"

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

/**
 * Ícono de cada paso, por la MISMA transición que decide el texto: el círculo
 * de la línea de tiempo se reconoce antes de leer, y así los dos no pueden
 * decir cosas distintas.
 */
function iconoDe(paso: {
  estadoAnterior: EstadoEgreso | null
  estadoNuevo: EstadoEgreso
}): LucideIcon {
  if (paso.estadoAnterior === null) return FilePlus
  if (paso.estadoNuevo === "ANULADO") return Ban
  if (paso.estadoNuevo === "BORRADOR") return X
  if (paso.estadoNuevo === "PENDIENTE_APROBADOR") return Send
  if (paso.estadoNuevo === "PENDIENTE_RESPONSABLE_ALMACEN") return Check
  return PackageCheck
}

interface HistorialEgresoProps {
  historial: EgresoHistorial[]
}

/**
 * Línea de tiempo del pedido, en zigzag: hilo vertical al centro, círculo con
 * el ícono del paso montado encima y las tarjetas alternando lado. La comparten
 * la ficha y el panel lateral del listado — es el mismo dato contado igual en
 * los dos lados.
 *
 * Cada tarjeta dice con qué sombrero actuó la persona, quién fue, y qué HIZO
 * («Aprobó el 20/03/2026, 14:12»), no en qué estado quedó el pedido; ver
 * `describirPaso`.
 *
 * Necesita ancho para las dos columnas: abajo de `sm` colapsa a una sola, con
 * todo del mismo lado del hilo.
 */
export function HistorialEgreso({ historial }: HistorialEgresoProps) {
  if (historial.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay movimientos.
      </p>
    )
  }

  // MÁS RECIENTE ARRIBA. El backend lo devuelve en orden cronológico
  // (`orderBy: id asc`) y acá se da vuelta para mostrarlo: lo que importa al
  // abrir un pedido es en qué anda ahora, no cómo empezó. Se copia el arreglo
  // porque el original vive en la caché de React Query.
  const recientesPrimero = [...historial].reverse()

  return (
    <div className="relative">
      {/* El hilo. Arranca y termina en el centro de los círculos extremos, por
          eso los `top`/`bottom` de 16 px: la mitad de un círculo de 32. */}
      <div className="absolute top-4 bottom-4 left-4 w-0.5 bg-primary/30 sm:left-1/2 sm:-translate-x-1/2" />

      <ol className="flex flex-col gap-4">
        {recientesPrimero.map((paso, indice) => {
          const { verbo, actor, consecuencia } = describirPaso(paso)
          const Icono = iconoDe(paso)
          // Alternan de lado. En pantallas chicas no hay lugar para dos
          // columnas: todo cae a la derecha del hilo.
          const aLaDerecha = indice % 2 === 1
          // Los pasos que FRENAN el circuito se marcan en rojo: así se ubica de
          // un vistazo dónde se trabó un pedido que dio vueltas.
          const frena =
            paso.estadoNuevo === "BORRADOR" || paso.estadoNuevo === "ANULADO"

          return (
            <li key={paso.id} className="relative sm:grid sm:grid-cols-2">
              <span
                className={cn(
                  "absolute top-0 left-4 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-sm sm:left-1/2",
                  frena
                    ? "border-destructive/30 text-destructive"
                    : "border-primary/30 text-primary"
                )}
              >
                <Icono className="size-4" />
              </span>

              <div
                className={cn(
                  "pl-10 sm:pl-0",
                  aLaDerecha ? "sm:col-start-2 sm:pl-6" : "sm:col-start-1 sm:pr-6"
                )}
              >
                <div className="rounded-lg border bg-card p-3 shadow-sm">
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase",
                      frena ? "text-destructive" : "text-primary"
                    )}
                  >
                    {actor}
                  </p>
                  <p className="mt-0.5 text-sm font-medium">
                    {paso.usuario.nombre}
                  </p>
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    {verbo} el {fechaHora(paso.createdAt)}
                  </p>
                  {consecuencia && (
                    <p className="text-xs text-muted-foreground">
                      {consecuencia}
                    </p>
                  )}
                  {paso.motivo && (
                    <p className="mt-2 rounded border-l-2 border-destructive/50 bg-muted/50 px-2 py-1 text-xs">
                      <span className="text-muted-foreground">Motivo: </span>
                      {paso.motivo}
                    </p>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Cierra el hilo: sin esto la línea se corta en el aire y parece que
          faltan pasos por cargar. */}
      <div className="flex flex-col items-center pt-2 pl-4 sm:pl-0">
        <ChevronUp className="size-4 text-primary/60" />
        <span className="text-xs font-medium text-primary/80">
          Inicio del pedido
        </span>
      </div>
    </div>
  )
}
