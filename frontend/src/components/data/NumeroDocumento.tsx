import { numeroDocumento } from "@/lib/formato"
import { cn } from "@/lib/utils"

/**
 * El número de un documento (ingreso o egreso) en las TABLAS.
 *
 * Dos decisiones, las dos por el mismo problema: `003/2026` se leía como una
 * FECHA —marzo de 2026— y en los listados cae al lado de dos columnas que sí
 * son fechas (`07/08/2026`). El ojo agrupa por patrón: tres números separados
 * por barra, en un vecindario de fechas, son una fecha.
 *
 * 1. **Jerarquía**: el correlativo grande y en negrita, la gestión chica y gris.
 * 2. **La gestión EN CURSO no se muestra.** Sería el mismo año repetido en todas
 *    las filas, que es ruido: la enorme mayoría de lo que se mira es del año
 *    corriente. Aparece SOLO en documentos de gestiones anteriores, que es justo
 *    cuando el dato dice algo — y ahí salta a la vista en vez de perderse entre
 *    cientos de repeticiones.
 *
 * Nada de esto cambia el FORMATO: el dato sigue siendo `003/2026` y los
 * documentos impresos —que dicen exactamente eso— no se tocan. Por eso
 * `etiquetaNumero()` sigue existiendo y devolviendo el string: lo necesitan el
 * PDF, el Excel, los títulos y los toasts, donde no hay estilos que aplicar. Y
 * por eso el número completo va igual en el `title`: no se pierde, se corre a
 * donde no estorba.
 */
export function NumeroDocumento({
  numero,
  gestion,
  className,
}: {
  numero: number | null
  gestion: number | null
  className?: string
}) {
  // Un borrador todavía no tiene número: se estampa al enviar.
  if (numero == null || gestion == null) {
    return <span className="text-muted-foreground">—</span>
  }

  const correlativo = String(numero).padStart(3, "0")
  // Dentro del render, como ya lo hace la pantalla de inicio: así una pestaña
  // abierta al cambiar de año no se queda mostrando la gestión vieja.
  const esGestionActual = gestion === new Date().getFullYear()

  return (
    <span
      className={cn("inline-flex items-baseline whitespace-nowrap", className)}
      // El número COMPLETO, con el mismo separador que los documentos: la
      // pantalla esconde la gestión en curso, pero al pasar el mouse aparece
      // exactamente lo que dice el papel.
      title={numeroDocumento({ numero, gestion })}
    >
      {/* SIN tamaño propio: hereda el de la tabla. Lo que lo destaca es el peso,
          no el cuerpo — agrandarlo desalineaba la fila contra las columnas
          vecinas. */}
      <span className="font-semibold tabular-nums">{correlativo}</span>
      {!esGestionActual && (
        <span className="ml-1 text-xs text-muted-foreground tabular-nums">
          {gestion}
        </span>
      )}
    </span>
  )
}
