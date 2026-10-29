/**
 * Copia texto al portapapeles. Devuelve si pudo.
 *
 * `navigator.clipboard` solo existe en contexto SEGURO (HTTPS o localhost): en la
 * VM de la demo, que se usa por `http://<ip>`, no está. Para ese caso queda el
 * método viejo — un `<textarea>` fuera de pantalla + `execCommand("copy")` —,
 * obsoleto pero todavía soportado por todos los navegadores, y que funciona
 * dentro del gesto del clic.
 */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      // Permiso denegado: se intenta el método viejo.
    }
  }

  // Dentro del diálogo abierto, si lo hay, y NO en el <body>: el diálogo de
  // Radix atrapa el foco y se lo quita a todo lo que esté afuera, así que el
  // texto quedaba sin seleccionar y `execCommand` «copiaba» nada devolviendo
  // true (verificado en la prueba por IP).
  const contenedor =
    document.activeElement?.closest('[role="dialog"]') ?? document.body
  const area = document.createElement("textarea")
  area.value = texto
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.top = "-1000px"
  contenedor.appendChild(area)
  area.focus()
  area.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    contenedor.removeChild(area)
  }
}
