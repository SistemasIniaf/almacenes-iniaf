import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Superficie de un campo de formulario: un relleno suave que lo despega de la
 * tarjeta donde vive (2026-08-07).
 *
 * Antes los campos iban `bg-transparent`, así que en modo claro eran blancos
 * sobre una tarjeta blanca sobre una página blanca — tres capas del mismo color,
 * y lo único que dibujaba el campo era su borde. Con relleno se lee «acá se
 * escribe» antes de leer la etiqueta.
 *
 * **Vive acá y no en cada componente porque son CINCO los que tienen que
 * coincidir**: `ui/input`, `ui/textarea`, el trigger de `ui/select` y los dos
 * campos que usan un `Button` de disparador (`ComboboxField`,
 * `DatePickerField`). Si uno queda con otro tono, una fila de formulario muestra
 * dos superficies distintas al lado.
 *
 * NO se cambió la variante `outline` del botón para conseguir esto: ese botón
 * también es una ACCIÓN («Reporte», «Cancelar»), y un botón que se ve como un
 * campo vacío es peor que uno sin relleno.
 */
export const SUPERFICIE_CAMPO = "bg-muted/60 dark:bg-input/40"
