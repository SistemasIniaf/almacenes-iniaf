/**
 * Color de los iconos de acción de las tablas, por lo que la acción SIGNIFICA.
 * El mismo verbo tiene que verse igual en todos los listados: si «ver» es
 * turquesa en ingresos, es turquesa en egresos.
 *
 * En reposo van TODOS en gris (`text-muted-foreground`), como en el resto de los
 * listados del sistema; el color del verbo aparece recién al pasar el mouse
 * (2026-10-14, pedido del usuario). Con el color siempre a la vista —ámbar,
 * rojo, turquesa— la columna de acciones competía con los datos de la fila.
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
  ver: "text-muted-foreground hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950 dark:hover:text-teal-300",
  editar:
    "text-muted-foreground hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950 dark:hover:text-amber-300",
  /** Mover el documento al siguiente paso del circuito. */
  enviar:
    "text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950 dark:hover:text-sky-300",
  /** Rojo «documento PDF», no el rojo de peligro. */
  pdf: "text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-300",
} as const
