/**
 * `@types/pdfmake` no declara las fuentes estándar, que sí existen en el
 * paquete (`build/standard-fonts/*.js`) y exportan un contenedor de fuente.
 * Se usa Helvetica para no arrastrar el vfs de Roboto (854 KB) ni embeber la
 * fuente en cada PDF: Helvetica es una de las 14 que todo lector ya trae.
 */
declare module "pdfmake/build/standard-fonts/Helvetica" {
  import type { TFontContainer } from "pdfmake/interfaces"

  const contenedorFuente: TFontContainer
  export default contenedorFuente
}
