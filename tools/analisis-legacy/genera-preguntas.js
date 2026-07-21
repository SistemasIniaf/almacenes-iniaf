const fs = require("fs")
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType,
} = require("docx")

const VERDE = "1B7F5A"
const GRIS = "595959"

const p = (texto, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120 },
    alignment: opts.alignment,
    children: [
      new TextRun({
        text: texto,
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
        font: "Calibri",
      }),
    ],
  })

const titulo = (texto) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text: texto, size: 30, bold: true, color: VERDE, font: "Calibri" })],
  })

/** Etiqueta en negrita + texto normal en el mismo parrafo. */
const campo = (etiqueta, texto, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 100 },
    children: [
      new TextRun({ text: etiqueta + " ", bold: true, size: 22, font: "Calibri", color: opts.color }),
      new TextRun({ text: texto, size: 22, font: "Calibri", italics: opts.italics }),
    ],
  })

const vinieta = (texto) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text: texto, size: 22, font: "Calibri" })],
  })

/** Renglones en blanco para escribir la respuesta a mano. */
const renglones = (n = 2) =>
  Array.from({ length: n }, () =>
    new Paragraph({
      spacing: { before: 160, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF" } },
      children: [new TextRun({ text: "", size: 22 })],
    })
  )

let contador = 0
function pregunta({ texto, contexto, hoy, opciones, sugerido, lineas = 2 }) {
  contador++
  const bloques = [
    new Paragraph({
      spacing: { before: 280, after: 100 },
      children: [
        new TextRun({ text: `${contador}. `, bold: true, size: 24, color: VERDE, font: "Calibri" }),
        new TextRun({ text: texto, bold: true, size: 24, font: "Calibri" }),
      ],
    }),
  ]
  if (contexto) bloques.push(campo("Contexto:", contexto))
  if (hoy) bloques.push(campo("Sistema anterior:", hoy, { color: GRIS }))
  if (opciones && opciones.length) {
    bloques.push(campo("Opciones:", "", { after: 40 }))
    opciones.forEach((o) => bloques.push(vinieta(o)))
  }
  if (sugerido) bloques.push(campo("Propuesta del equipo de sistemas:", sugerido, { italics: true }))
  bloques.push(campo("Respuesta:", "", { after: 0 }))
  bloques.push(...renglones(lineas))
  return bloques
}

const recuadro = (lineas) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: "F2F7F5" },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: lineas.map((l) =>
              typeof l === "string" ? p(l, { after: 60 }) : l
            ),
          }),
        ],
      }),
    ],
  })

const doc = new Document({
  creator: "INIAF - Unidad de Sistemas",
  title: "Preguntas para el encargado de almacenes",
  sections: [
    {
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      children: [
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: "SISTEMA DE ALMACENES — INIAF", bold: true, size: 36, color: VERDE, font: "Calibri" }),
          ],
        }),
        p("Preguntas para el encargado de almacenes", { size: 28, bold: true, after: 80 }),
        p("Documento de trabajo · La Paz, 21 de julio de 2026", { size: 20, color: GRIS, after: 300 }),

        recuadro([
          "Para qué sirve este documento",
          "El sistema nuevo de almacenes está en construcción. Las preguntas que siguen son decisiones de negocio que el equipo de sistemas no puede tomar solo: definen cómo se guarda la información y, una vez cargados los datos reales, cambiarlas es costoso.",
          "Cada pregunta trae el contexto, lo que hace hoy el sistema anterior (verificado sobre su base de datos, gestiones 2015 a 2026) y una propuesta. Alcanza con confirmar o corregir.",
          "Las preguntas de la Parte 1 bloquean el avance; el resto se puede ir respondiendo después.",
        ]),

        p("", { after: 200 }),
        campo("Diferencia principal con el sistema anterior:", "el sistema nuevo maneja varios almacenes independientes (cada uno con su propio stock y su propia numeración), mientras que el anterior llevaba el almacén a nivel de unidad. Además, el circuito de aprobación de egresos tiene 2 niveles: solicitante → aprobador de la unidad → responsable de almacén, que es quien entrega y descarga el stock."),

        titulo("Parte 1 · Decisiones que bloquean el diseño"),

        ...pregunta({
          texto: "¿El stock se sigue llevando separado por fuente de financiamiento (fondo)?",
          contexto:
            "Cada compra se paga con recursos de algún origen: recursos propios, TGN de un programa, o un proyecto con financiador externo. La pregunta es si el saldo del almacén debe estar dividido por ese origen. Ejemplo: 100 resmas compradas con Banco Mundial y 50 con TGN Trigo, ¿son dos saldos separados o son 150 resmas?",
          hoy:
            "Sí, separa. Todos los reportes de kardex filtran por fondo. Hay 93 fondos registrados y más de 15 con movimiento habitual (Recursos Específicos, Banco Mundial, COSUDE, DANIDA, KOPIA, y programas TGN de trigo, papa, hortalizas, apícola, entre otros). El 35% de los ítems se compró con más de un fondo: la gasolina figura con 21 fondos distintos y el papel bond con 18.",
          opciones: [
            "Sí, separado por fondo: cada fondo tiene su propio saldo y al entregar material hay que indicar de qué fondo sale.",
            "No: un solo saldo por ítem y almacén. El fondo queda registrado en el ingreso, solo como dato informativo para reportes.",
          ],
          sugerido:
            "Mantenerlo separado, salvo que la rendición a los financiadores ya no lo exija. Es la decisión más costosa de revertir más adelante.",
        }),

        ...pregunta({
          texto: "Cuando sale material del almacén, ¿a qué precio se valora?",
          contexto:
            "El mismo ítem se compra a distintos precios a lo largo del año. Cuando salen 20 resmas, hay que decidir cuánto valen: el precio de la compra específica de donde salieron, o un precio promedio de todas las compras. De esto depende cómo se guarda el stock: por lote (cada compra por separado, con su precio) o como un total único por ítem.",
          hoy:
            "Por lote. Cada salida apunta a la compra concreta de la que salió y se valora a ese precio exacto. El 41% de los ítems se compró a más de un precio en la misma gestión (el papel bond carta va desde Bs 0 hasta Bs 111). En el 2% de los casos una sola salida tuvo que tomar de varias compras distintas del mismo ítem, y se registraron hasta 70 compras para un mismo pedido.",
          opciones: [
            "Por lote, como ahora: al entregar se indica de qué compra sale y el costo es el de esa compra.",
            "Promedio ponderado: un solo saldo por ítem con un costo promedio que se recalcula en cada ingreso. Es más simple de operar, pero el kardex deja de mostrar el costo exacto de cada compra.",
          ],
          sugerido:
            "Mantener el manejo por lote si el kardex valorado se usa para rendiciones o auditoría. Si solo se necesita saber cuánto hay y cuánto vale en total, el promedio ponderado simplifica mucho la operación diaria.",
        }),

        ...pregunta({
          texto: "¿Qué información se traslada del sistema anterior al nuevo?",
          contexto:
            "El sistema anterior tiene 11 gestiones cargadas: 23.005 ítems en el catálogo, 22.850 ingresos y 38.594 egresos. Hay que definir qué se importa al arrancar.",
          hoy: "No aplica.",
          opciones: [
            "Catálogo y saldos: se importan los ítems, los proveedores y el stock existente al momento del arranque (como saldo inicial). El histórico queda en el sistema anterior, disponible para consulta.",
            "Todo el histórico: además se migran los movimientos de las 11 gestiones, para tener el kardex completo en el sistema nuevo.",
            "Nada: todo se carga a mano en el sistema nuevo.",
          ],
          sugerido:
            "Importar catálogo y saldos. Cargar 23.005 ítems a mano no es viable, y los movimientos históricos no se usan para operar; además el sistema anterior arrastra inconsistencias (saldos negativos, números de ingreso repetidos) que conviene no trasladar.",
        }),

        titulo("Parte 2 · Ingresos al almacén"),

        ...pregunta({
          texto: "¿Qué tipos de ingreso existen?",
          contexto: "Sirve para saber qué datos son obligatorios en cada caso (por ejemplo, una donación no tiene factura).",
          hoy:
            "Tres tipos: ingreso por compra (15.433 registros), ingreso de saldos de la gestión anterior (7.396) e ingreso por devolución (21).",
          opciones: [
            "Compra a proveedor",
            "Saldo inicial / traspaso de gestión",
            "Devolución de material no utilizado",
            "Donación o transferencia de otra entidad",
            "Otro (indicar cuál)",
          ],
          sugerido: "Confirmar si la donación se registra hoy como compra o si necesita su propio tipo.",
        }),

        ...pregunta({
          texto: "¿Todo ingreso tiene proveedor?",
          contexto: "Define si el proveedor es un dato obligatorio o puede quedar vacío según el tipo de ingreso.",
          hoy:
            "El proveedor es obligatorio siempre, y por eso se creó un proveedor ficticio llamado «SALDOS 2014» para poder cargar los saldos iniciales. Es una salida forzada por el sistema, no una decisión del almacén.",
          opciones: [
            "El proveedor es obligatorio solo en ingresos por compra; en saldos iniciales y devoluciones queda vacío.",
            "Siempre obligatorio.",
          ],
          sugerido: "Obligatorio solo en compras, para no seguir usando proveedores ficticios.",
        }),

        ...pregunta({
          texto: "¿Qué documentos de respaldo se registran en un ingreso?",
          contexto: "Cada dato que se registre va a poder consultarse y buscarse después.",
          hoy:
            "Se guardan número de factura, nota de remisión, certificación presupuestaria, número de proceso de contratación y número de solicitud. De 22.850 ingresos, 3.958 (17%) no tienen número de factura registrado.",
          opciones: [
            "Los mismos cinco datos del sistema anterior",
            "Solo factura y nota de remisión",
            "Otros (indicar cuáles)",
          ],
          sugerido:
            "Definir además cuáles son obligatorios y cuáles opcionales, y si hace falta adjuntar el archivo escaneado de la factura (el sistema ya soporta adjuntar archivos).",
        }),

        ...pregunta({
          texto: "¿Cómo se numeran los ingresos?",
          contexto:
            "En el sistema nuevo cada almacén lleva su propia numeración, generada automáticamente y sin posibilidad de repetirse.",
          hoy:
            "La numeración reinicia cada gestión y por unidad, pero no es confiable: se detectaron números repetidos (una unidad registró 156 ingresos en 2023 con números del 1 al 111) y hasta números en cero.",
          opciones: [
            "Reiniciar cada gestión, por almacén (número visible: ALMACÉN-2026-000123)",
            "Numeración corrida sin reinicio",
          ],
          sugerido: "Reiniciar cada gestión y por almacén, que es como se opera hoy.",
        }),

        ...pregunta({
          texto: "¿Se pueden registrar ingresos con fecha anterior a hoy? ¿Hasta cuándo?",
          contexto:
            "Permitir fechas pasadas es cómodo cuando la factura llega tarde, pero puede alterar reportes ya presentados.",
          hoy: "Sin restricción: se registran ingresos con cualquier fecha.",
          opciones: [
            "Sí, sin límite dentro de la gestión abierta",
            "Sí, hasta X días atrás (indicar cuántos)",
            "No, siempre la fecha del día",
          ],
        }),

        ...pregunta({
          texto: "¿Qué se hace si un ingreso se registró con un error?",
          contexto:
            "El sistema nuevo no borra registros: los anula y deja constancia de quién lo hizo y por qué. Falta definir quién puede hacerlo y hasta cuándo.",
          hoy: "No hay un procedimiento formal de anulación registrado.",
          opciones: [
            "Lo corrige el responsable del almacén, mientras no haya salido material de ese ingreso",
            "Lo anula el responsable con motivo obligatorio, y se registra uno nuevo",
            "Requiere autorización de un administrador",
          ],
          sugerido:
            "Anulación con motivo obligatorio, bloqueada si ya se entregó material de ese ingreso.",
        }),

        titulo("Parte 3 · Egresos (salidas de almacén)"),

        ...pregunta({
          texto: "¿El circuito de aprobación es correcto?",
          contexto:
            "El circuito definido es: el solicitante crea el pedido → lo aprueba el jefe de su unidad → el responsable del almacén lo aprueba y entrega, descargando el stock. Cada nivel puede ajustar las cantidades.",
          hoy:
            "El sistema anterior también manejaba dos firmas: un verificador y un aprobador, cada uno con su fecha.",
          opciones: ["Correcto", "Falta o sobra un nivel (indicar cuál)"],
        }),

        ...pregunta({
          texto: "Cuando un pedido se rechaza, ¿a dónde vuelve?",
          contexto:
            "Puede volver al solicitante para que lo corrija desde el principio, o retroceder un solo paso.",
          hoy: "No verificado.",
          opciones: [
            "Siempre vuelve al solicitante, que corrige y lo envía de nuevo",
            "Vuelve al nivel anterior",
          ],
          sugerido: "Que siempre vuelva al solicitante: es más simple de seguir y de auditar.",
        }),

        ...pregunta({
          texto: "¿El solicitante puede anular su propio pedido antes de que lo aprueben?",
          opciones: ["Sí, mientras nadie lo haya aprobado", "No, una vez enviado sigue el circuito"],
        }),

        ...pregunta({
          texto: "¿Qué pasa si al momento de entregar ya no hay stock suficiente?",
          contexto:
            "Entre que se aprueba el pedido y se entrega el material puede haber salido stock por otro pedido.",
          opciones: [
            "Se entrega lo que hay y el pedido queda cerrado con esa cantidad",
            "Se entrega lo que hay y queda un saldo pendiente de entrega",
            "El pedido se rechaza y vuelve al solicitante",
          ],
          sugerido:
            "Entregar lo disponible y cerrar el pedido, dejando registrada la diferencia respecto de lo solicitado.",
        }),

        ...pregunta({
          texto: "¿Hay pedidos que puedan saltar niveles de aprobación?",
          contexto: "Por ejemplo, pedidos de poco monto o de material de uso corriente.",
          opciones: ["No, todos siguen el mismo circuito", "Sí (indicar el criterio: monto, tipo de material, urgencia)"],
        }),

        ...pregunta({
          texto: "¿Qué se hace cuando el jefe de unidad o el responsable de almacén están ausentes?",
          contexto:
            "Solo puede haber un aprobador activo por unidad y un responsable activo por almacén. Si esa persona no está, los pedidos se frenan.",
          opciones: [
            "Se designa un suplente temporal desde el sistema",
            "Un administrador puede aprobar en su lugar",
            "Los pedidos esperan a que la persona vuelva",
          ],
          sugerido: "Contemplar la suplencia temporal: es la situación más común de bloqueo.",
        }),

        ...pregunta({
          texto: "¿El egreso debe registrar la actividad o el destino del material?",
          contexto:
            "Permite después reportar el consumo por actividad, proyecto o programa.",
          hoy:
            "Sí: el egreso tiene un campo obligatorio de actividad (hasta 200 caracteres) y una categoría.",
          opciones: [
            "Sí, texto libre como ahora",
            "Sí, pero eligiendo de una lista predefinida de actividades",
            "No hace falta",
          ],
        }),

        ...pregunta({
          texto: "¿Se puede anular un egreso ya entregado? ¿Quién autoriza y hasta cuándo?",
          contexto:
            "Anular devuelve el material al stock y genera un movimiento de reversión en el kardex. Queda registrado quién lo hizo y por qué.",
          opciones: [
            "Lo anula el responsable del almacén con motivo obligatorio",
            "Requiere autorización superior",
            "Solo dentro de un plazo (indicar cuántos días)",
          ],
        }),

        titulo("Parte 4 · Cierre de gestión"),

        recuadro([
          "Ya confirmado: el cierre debe arrastrar los saldos automáticamente a la gestión siguiente, en lugar de volver a cargarlos a mano como se hace hoy (en el sistema anterior, un tercio de todos los ingresos registrados son recargas de saldos de la gestión anterior).",
        ]),
        p("", { after: 120 }),

        ...pregunta({
          texto: "¿Quién ejecuta el cierre de gestión y cuándo?",
          opciones: [
            "Un administrador del sistema, en una fecha definida",
            "Cada responsable cierra su propio almacén",
          ],
        }),

        ...pregunta({
          texto: "Una vez cerrada la gestión, ¿se pueden registrar movimientos con fecha de esa gestión?",
          opciones: [
            "No: queda bloqueada y solo se consulta",
            "Sí, con autorización de un administrador",
          ],
          sugerido: "Bloquearla, para que los reportes ya presentados no cambien.",
        }),

        titulo("Parte 5 · Reportes"),

        ...pregunta({
          texto: "¿Qué reportes se necesitan y quién los usa?",
          contexto:
            "Conviene listar los que se entregan hoy a otras instancias (auditoría, financiero, financiadores), con su formato y periodicidad.",
          hoy:
            "El sistema anterior emite kardex valorado por unidad, fondo y gestión, y un reporte de mínimos y máximos por ítem (este último ya se descartó para el sistema nuevo).",
          opciones: [
            "Kardex valorado por ítem y almacén",
            "Resumen de existencias a una fecha",
            "Consumo por unidad solicitante",
            "Consumo por partida presupuestaria",
            "Ingresos por proveedor",
            "Otros (indicar cuáles)",
          ],
          lineas: 4,
        }),

        ...pregunta({
          texto: "¿Los egresos se deben reportar agrupados por partida presupuestaria?",
          contexto:
            "Es decir, si se necesita saber cuánto se consumió de cada objeto del gasto, para ejecución presupuestaria.",
          opciones: ["Sí", "No, la partida solo importa en el catálogo y en el ingreso"],
        }),

        titulo("Parte 6 · Detalles menores"),

        ...pregunta({
          texto: "¿Las cantidades pueden tener decimales?",
          contexto: "Por ejemplo, kilos o litros.",
          hoy:
            "Sí. Se registraron 2.903 líneas con cantidades no enteras, y precios unitarios con hasta cinco decimales.",
          opciones: ["Sí, con dos decimales", "Solo cantidades enteras"],
          lineas: 1,
        }),

        ...pregunta({
          texto: "¿Los precios se registran con IVA incluido?",
          opciones: ["Con IVA", "Sin IVA", "Ambos, se registran por separado"],
          lineas: 1,
        }),

        ...pregunta({
          texto: "¿Quién puede ver el stock de todos los almacenes y quién solo el suyo?",
          contexto:
            "El sistema contempla un rol de observador, para auditoría, que consulta sin poder modificar.",
          opciones: [
            "Cada responsable ve solo su almacén; administración y auditoría ven todos",
            "Todos los responsables ven todos los almacenes",
          ],
          lineas: 1,
        }),

        p("", { after: 300 }),
        recuadro([
          "Firmas",
          "",
          "Encargado de almacenes: ______________________________    Fecha: ____________",
          "",
          "Por la Unidad de Sistemas: ___________________________    Fecha: ____________",
        ]),
      ],
    },
  ],
})

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(process.argv[2], buffer)
  console.log("Generado: " + process.argv[2])
  console.log("Preguntas: " + contador)
})
