/**
 * `001-2026`, como se imprime en todos los documentos. Del lado del servidor se
 * usa en el REPORTE de kardex (en el papel el numero va entero y la fila es una
 * celda de texto) y en los mensajes de error que nombran documentos.
 *
 * **Tiene que coincidir con `numeroDocumento()` de `lib/formato.ts` del
 * frontend.** Es el UNICO formateo de numero de documento del servidor: vivia
 * dentro de `kardex.service.ts` y salio aca cuando lo necesito ingresos, para
 * que siga siendo uno solo. Si vuelve a cambiar el formato, este es el segundo
 * lugar a tocar.
 */
export function formatearNumero(
  numero?: number | null,
  gestion?: number | null,
): string | null {
  if (numero == null || gestion == null) return null;
  return `${String(numero).padStart(3, '0')}-${gestion}`;
}
