/**
 * Base compartida de los documentos PDF (nota de ingreso, estado de almacenes).
 *
 * Acá vive lo que costó descubrir una vez y no conviene repetir: cómo se carga
 * pdfmake, qué fuente se usa y cómo se embeben los logos. El maquetado de cada
 * documento va en su propio archivo.
 */

import { LOGOS_ORIGINALES, logosQueryOptions, urlLogo } from "@/lib/logos"
import { queryClient } from "@/lib/query-client"

import type { LogoClave, LogosVigentes } from "@/lib/logos"
import type { Column } from "pdfmake/interfaces"

/** Márgenes de hoja en PUNTOS (1 pulgada = 72 pt). 34 pt ≈ 12 mm. */
export const MARGEN_PDF = 34

interface LogoEmbebido {
  dataUrl: string
  /** Ancho / alto del archivo. El Excel la necesita para no deformarlo. */
  proporcion: number
}

/**
 * pdfmake necesita las imágenes embebidas; se leen una vez y quedan cacheadas.
 * La clave es la URL, y cada logo subido tiene nombre propio: al reemplazarlo
 * cambia la URL y el viejo deja de pedirse solo.
 */
const cacheLogos = new Map<string, LogoEmbebido>()

async function embeber(ruta: string): Promise<LogoEmbebido> {
  const cacheado = cacheLogos.get(ruta)
  if (cacheado) return cacheado

  const respuesta = await fetch(ruta)
  if (!respuesta.ok) throw new Error(`No se pudo leer el logo ${ruta}`)
  const blob = await respuesta.blob()
  const [dataUrl, bitmap] = await Promise.all([
    new Promise<string>((resolver, rechazar) => {
      const lector = new FileReader()
      lector.onload = () => resolver(lector.result as string)
      lector.onerror = () => rechazar(lector.error)
      lector.readAsDataURL(blob)
    }),
    createImageBitmap(blob),
  ])
  const logo = { dataUrl, proporcion: bitmap.width / bitmap.height }
  bitmap.close()

  cacheLogos.set(ruta, logo)
  return logo
}

/**
 * El logo vigente de un casillero; si el subido no se puede leer, el original.
 * Un documento oficial sin logo es peor que uno con el logo de antes.
 */
async function logoVigente(
  logos: LogosVigentes | undefined,
  clave: LogoClave
): Promise<LogoEmbebido> {
  try {
    return await embeber(urlLogo(logos, clave))
  } catch {
    return embeber(LOGOS_ORIGINALES[clave])
  }
}

/**
 * Los dos logos del membrete —los VIGENTES, que se cambian desde la pantalla
 * «Logos»—, listos para `image:` de pdfmake. Lo usan también los Excel.
 */
export async function logosMembrete() {
  const logos = await queryClient
    .fetchQuery(logosQueryOptions)
    .catch(() => undefined)
  const [iniaf, ministerio] = await Promise.all([
    logoVigente(logos, "INIAF"),
    logoVigente(logos, "MINISTERIO"),
  ])
  return {
    iniaf: iniaf.dataUrl,
    ministerio: ministerio.dataUrl,
    proporciones: {
      iniaf: iniaf.proporcion,
      ministerio: ministerio.proporcion,
    },
  }
}

/**
 * Columna de logo del membrete con una CAJA fija (en pt). El logo se encaja
 * adentro sin deformarse (`fit`) y la columna conserva su ancho aunque el logo
 * sea más angosto: como los logos se pueden reemplazar, sin esto un archivo
 * con otra proporción correría el título o haría crecer el membrete encima de
 * la tabla.
 */
export function columnaLogo(
  imagen: string,
  [ancho, alto]: [number, number],
  alineacion: "left" | "right"
): Column {
  return {
    width: ancho,
    stack: [{ image: imagen, fit: [ancho, alto], alignment: alineacion }],
  }
}

/**
 * Carga pdfmake con la fuente lista.
 *
 * Dos cosas que no son obvias:
 * - pdfmake es **CommonJS**: la instancia llega en `.default`. Los nombres
 *   sueltos del namespace NO sirven — sus métodos vienen del prototipo y el
 *   interop del bundler no los expone (`addFontContainer is not a function`).
 * - Se usa **Helvetica**, una de las 14 fuentes que todo lector de PDF ya trae:
 *   son 300 KB en vez de los 854 KB del vfs de Roboto y no se embebe nada.
 *
 * El `import()` es dinámico para que pdfmake no pese en el bundle de quien
 * nunca imprime.
 */
export async function cargarPdfMake() {
  const [modulo, helvetica] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/standard-fonts/Helvetica"),
  ])
  const pdfMake = modulo.default ?? modulo
  pdfMake.addFontContainer(helvetica.default ?? helvetica)
  return pdfMake
}

/** Lo que devuelve `pdfMake.createPdf(...)`, en lo que acá se usa. */
interface DocumentoPdf {
  open: (ventana: Window) => void | Promise<void>
  download: (nombre: string) => void | Promise<void>
}

/**
 * Abre una pestaña en blanco para un PDF que todavía no existe.
 *
 * **Hay que llamarla DENTRO del gesto del clic**, antes de cualquier `await`:
 * si la pestaña se abriera después de generar el documento, el navegador la
 * bloquearía como emergente.
 */
export function abrirPestanaPdf(): Window | null {
  return window.open("", "_blank")
}

/**
 * Muestra el documento en la pestaña ya abierta y, si el navegador la bloqueó
 * igual, lo descarga — que es la única salida que queda sin pestaña.
 */
export async function mostrarPdf(
  ventana: Window | null,
  documento: DocumentoPdf,
  nombre: string
): Promise<void> {
  if (ventana) await documento.open(ventana)
  else await documento.download(nombre)
}
