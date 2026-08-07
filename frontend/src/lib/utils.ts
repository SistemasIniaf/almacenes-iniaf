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

/**
 * El botón «Agregar ítem» de los dos formularios de líneas (`IngresoLineas` y
 * `EgresoLineas`).
 *
 * **Vive acá porque los dos tienen que verse IGUALES** y hasta el 2026-08-07 la
 * cadena estaba copiada en los dos archivos, sincronizada a mano — con una nota
 * en CLAUDE.md pidiendo acordarse. Ahora no hay de qué acordarse.
 *
 * **Va en ÁMBAR, no en el primario** (pedido del usuario). El primario no servía:
 * en modo oscuro `--primary` (`oklch(0.432)`) es MÁS OSCURO que el panel donde
 * cae el botón (~`0.235`), y como acá el color se usa de texto y de borde —no de
 * relleno, como en «Guardar»— el botón se perdía. En claro nunca falló, porque
 * ahí el primario sí contrasta contra el blanco.
 *
 * Sigue **punteado y sin relleno sólido**: el sólido está reservado al submit,
 * que tiene que ser el único botón macizo del formulario.
 *
 * **Los dos modos están afinados por separado, y no es un descuido** — es lo
 * único importante de acá. El MISMO ámbar se comporta al revés en cada mitad
 * del tema: sobre blanco es un naranja vivo que se vuelve lo más colorido de una
 * pantalla por lo demás neutra, y sobre el panel oscuro, a baja opacidad, se
 * apaga hasta perderse. Igualar los números de los dos lados —que es lo que uno
 * quiere hacer al verlos distintos— rompe uno para arreglar el otro.
 *
 * De ahí las dos diferencias: en claro el texto va `amber-800`, que es **marrón
 * y no naranja**, con el borde y el relleno más marcados para que igual se lea;
 * en oscuro va `amber-400` con el borde y el relleno más tenues. Se ajustó tres
 * veces mirando las dos capturas, así que si tocás una mitad, mirá la otra.
 *
 * El **hover lo marcan el borde y el relleno, no el texto**, que queda igual que
 * en reposo. ⚠️ Aun así las clases de `hover:` NO se pueden omitir: la variante
 * `outline` del botón trae su propio `hover:bg-muted hover:text-foreground`, así
 * que sin pisarlas el botón salta al gris del tema al pasar el mouse.
 *
 * ⚠️ El ámbar ya significa otras dos cosas en el sistema —«editar» en
 * `TONO_ACCION` y «esto espera tu atención» en los badges y las tarjetas del
 * inicio—, así que acá está usado como color de MARCA del botón, no como aviso.
 * Si algún día hace falta un amarillo que de verdad alerte, este es el que
 * primero le compite.
 */
export const BOTON_AGREGAR_LINEA =
  "h-11 w-full border-dashed border-amber-600/55 bg-amber-500/[0.09] font-medium text-amber-800 hover:border-amber-600/75 hover:bg-amber-500/15 hover:text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/5 dark:text-amber-400 dark:hover:border-amber-400/60 dark:hover:bg-amber-400/10 dark:hover:text-amber-400"

/**
 * El mismo botón cuando el arreglo de líneas tiene error (ej. «Agregá al menos
 * un ítem»): pasa a rojo, que es lo único que lo saca del ámbar de siempre.
 */
export const BOTON_AGREGAR_LINEA_ERROR =
  "border-destructive/60 bg-destructive/5 text-destructive hover:border-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive dark:hover:bg-destructive/20"
