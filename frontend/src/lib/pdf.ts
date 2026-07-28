/**
 * Base compartida de los documentos PDF (nota de ingreso, estado de almacenes).
 *
 * Acá vive lo que costó descubrir una vez y no conviene repetir: cómo se carga
 * pdfmake, qué fuente se usa y cómo se embeben los logos. El maquetado de cada
 * documento va en su propio archivo.
 */

/** Márgenes de hoja en PUNTOS (1 pulgada = 72 pt). 34 pt ≈ 12 mm. */
export const MARGEN_PDF = 34

const LOGOS = {
  iniaf: "/iniaf/logo-iniaf.png",
  ministerio: "/iniaf/logo-ministerio.png",
} as const

/** pdfmake necesita las imágenes embebidas; se leen una vez y quedan cacheadas. */
const cacheLogos = new Map<string, string>()

async function comoDataUrl(ruta: string): Promise<string> {
  const cacheado = cacheLogos.get(ruta)
  if (cacheado) return cacheado

  const respuesta = await fetch(ruta)
  if (!respuesta.ok) throw new Error(`No se pudo leer el logo ${ruta}`)
  const blob = await respuesta.blob()
  const dataUrl = await new Promise<string>((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => resolver(lector.result as string)
    lector.onerror = () => rechazar(lector.error)
    lector.readAsDataURL(blob)
  })

  cacheLogos.set(ruta, dataUrl)
  return dataUrl
}

/** Los dos logos del membrete, listos para `image:` de pdfmake. */
export async function logosMembrete() {
  const [iniaf, ministerio] = await Promise.all([
    comoDataUrl(LOGOS.iniaf),
    comoDataUrl(LOGOS.ministerio),
  ])
  return { iniaf, ministerio }
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
