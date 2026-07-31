/**
 * Color de los iconos de acción de las tablas, por lo que la acción SIGNIFICA.
 * El mismo verbo tiene que verse igual en todos los listados: si «ver» es
 * turquesa en ingresos, es turquesa en egresos.
 *
 * Va en un archivo aparte y no dentro de `IconAction` porque exportar constantes
 * desde un archivo de componentes rompe el fast refresh de Vite (la regla
 * `react-refresh/only-export-components` del repo).
 *
 * `eliminar` NO está acá: esa se pide con la prop `destructiva` de `IconAction`,
 * que usa el rojo del tema. Es la única cuyo color significa «cuidado» y no
 * «esta es la acción tal».
 */
export const TONO_ACCION = {
  /** Consultar sin modificar: ver la ficha, abrir el historial. */
  ver: "text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-950 dark:hover:text-teal-300",
  editar:
    "text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950 dark:hover:text-amber-300",
  /** Mover el documento al siguiente paso del circuito. */
  enviar:
    "text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950 dark:hover:text-sky-300",
  /**
   * Rojo «documento PDF», no el rojo de peligro. Va un par de pasos MÁS CLARO
   * que el rojo del tema: este icono se dibuja macizo, y en una figura rellena
   * un rojo pleno ocupa tanta superficie que grita. Al pasar el mouse sube al
   * tono lleno, así que el estado interactivo no se pierde.
   */
  pdf: "text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300",
} as const

/**
 * Icono MACIZO: los de lucide vienen con trazo de color y relleno vacío, así que
 * se invierten las dos cosas — relleno del color actual y trazo del color del
 * fondo, con lo que los detalles internos quedan en negativo.
 *
 * Se usa SOLO en el PDF, para que la acción más buscada de la fila salte a la
 * vista. Se probó en el resto (lápiz, avión, papelera) y se descartó: con todos
 * macizos la columna se recarga y ninguno destaca. Los demás van con el trazo
 * normal de lucide.
 *
 * ⚠️ Si se aplica a otro icono, que sea uno cuya silueta sea una figura CERRADA.
 * En uno hecho de líneas abiertas —`TrendingUp`, el del historial— el SVG cierra
 * cada trazo por su cuenta para poder rellenarlo, y salen triángulos donde
 * debería haber una línea.
 */
export const MACIZO = "fill-current stroke-background"
