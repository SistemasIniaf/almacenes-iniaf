# Ingresos — todo lo conversado

> Sesión del **2026-07-21**. Recoge la consulta al encargado de almacenes,
> contrastada punto por punto con el sistema anterior del INIAF.
>
> Cada punto trae: **qué se preguntó**, **qué hace hoy el sistema anterior** (con
> datos verificados sobre su base, ver
> [analisis-sistema-anterior.md](analisis-sistema-anterior.md)), **qué se
> decidió** y, donde corresponde, **qué quedó abierto**.
>
> El cuestionario para la reunión está en `preguntas-encargado-almacenes.docx`.

---

## 1. ¿El stock se separa por fuente de financiamiento?

**De qué se trata.** Cada compra se paga con recursos de algún origen: recursos
propios, TGN de un programa, o un proyecto con financiador externo. La pregunta
es si el saldo del almacén debe estar dividido por ese origen. Ejemplo: 100
resmas compradas con Banco Mundial y 50 con TGN Trigo, ¿son dos saldos separados
o son 150 resmas? Se separa porque cada financiador exige rendir cuentas de en
qué se gastó **su** plata.

**Sistema anterior.** Sí separa. La columna es `ingresosalmacenes.IDFONDO` y
**todas** las consultas del kardex la llevan en el `WHERE`: no existe una vista
consolidada, hay que elegir una fuente para poder ver el kardex.

- 93 fuentes registradas, más de 15 con movimiento habitual: Recursos
  Específicos, Banco Mundial, COSUDE, DANIDA, KOPIA y programas TGN (trigo,
  papa, hortalizas, apícola, oleíferas, ganadería, granos andinos).
- **El 35% de los ítems se compró con más de una fuente.** La gasolina figura
  con 21 fuentes distintas; el papel bond, con 18.

**✅ Decidido.** Sí, el stock se separa por fuente. El nombre definitivo es
**FUENTE DE FINANCIAMIENTO** (ya no "fondo", como se llamaba en el sistema
anterior). Es un **CRUD propio** y **una sola fuente por ingreso** (va en la
cabecera, no por línea).

**✅ Decidido — el catálogo.** Campos:

| Campo | Notas |
|---|---|
| `nombre` | Único. Ej. «Banco Mundial», «TGN Programa Trigo» |
| `codigo` | Opcional, por si el área financiera maneja uno propio |
| `activo` | Baja lógica |

**Sin versionado por gestión**: si una fuente deja de usarse se desactiva, y los
lotes viejos la conservan igual. Baja lógica siempre — una fuente va a estar
referenciada por lotes históricos y borrarla rompería el kardex, igual que pasa
con los proveedores.

---

## 2. ¿El stock se lleva por lote o como total?

**De qué se trata.** Dos formas de llevar la cuenta:

- **Total:** «Papel bond carta: 150 unidades». Un solo número por ítem y almacén.
- **Por lote:** «Papel bond carta: 100 de la compra de marzo a Bs 25 c/u + 50 de
  la compra de agosto a Bs 30 c/u». Cada compra identificada, con su precio.

Importa por el costo: cuando salen 20 resmas, ¿valen Bs 25, Bs 30 o un promedio?

**Sistema anterior.** Por lote, y de forma explícita:

- `ingresositems` guarda por línea su `PRECIOUNITARIO` y su `SALDOCANTIDAD`.
- `egresositems.IDINGRESOITEM` apunta a la compra concreta de la que sale.
- El kardex valoriza cada salida con `cantidad × preciounitario` **del lote**.

Datos: el **41%** de los ítems se compró a más de un precio en la misma gestión
(el papel bond carta va de Bs 0 a Bs 111). El 2% de las salidas tomó de varios
lotes del mismo ítem, con un máximo de 70 lotes en un solo pedido.

**✅ Decidido.** Por **lote**.

**⚠️ Aprendizaje a no repetir.** El `SALDOCANTIDAD` del sistema anterior está
desincronizado en el **59% de los lotes** (72.603 de 123.028) y tiene saldos
negativos, porque se actualiza fuera de transacción. En el sistema nuevo el
saldo del lote se modifica **dentro de la transacción** que lo mueve, y queda
una tabla de movimientos que permite recalcularlo.

---

## 3. ¿Qué tipos de ingreso existen?

**Sistema anterior.** Tres, en `IDTIPODOCUMENTO`:

| Tipo | Registros | c/factura | c/nota rem. | c/certif. | c/proceso |
|---|---|---|---|---|---|
| 37 — Ingreso (compra) | 15.433 | 86% | 30% | 73% | 24% |
| 39 — Ingreso saldos | 7.396 | 74% | 31% | 67% | 19% |
| 38 — Ingreso devolución | 21 | 10% | 0% | 0% | 5% |

**«Ingreso saldos» no es un tipo de documento: es la apertura de gestión.** El
99,7% se carga en enero (7.371 de 7.396) y copia los datos del ingreso original,
por eso tiene factura. Lo genera automáticamente el proceso de cierre (ver
punto 9).

**«Ingreso devolución» son correcciones de salidas**, no devoluciones al
proveedor. Textual de las observaciones de la base:

> «Combustible no retirado del surtidor» — 40 lts de gasolina
> «Vale no retirado, por vencimiento de la autorización (Sustancias Controladas)»
> «reversión de 2 unidades de correa B-86 aprobadas en la salida erróneamente»
> «ERROR EN LA APROPIACIÓN DE LA FUENTE PARA LA SALIDA DE MATERIAL DE ALMACÉN»
> «Vale anulado»

El caso típico: se autorizó una salida (un vale de combustible), el material
nunca se retiró o se descargó del lote equivocado, y hay que devolverlo al
stock. Se usó **21 veces en 11 años** y ninguna desde 2021.

**✅ Decidido.** **No hay tipo de ingreso.** Los dos casos especiales
desaparecen por diseño:

- Los **saldos** ya no generan ingresos nuevos: con el cierre automático el lote
  **sigue vivo** en la gestión siguiente.
- Las **devoluciones** las resuelve la **anulación de egreso**, que revierte el
  material al lote original con motivo y responsable. Es más limpio, porque
  queda ligada al egreso que corrige en lugar de aparecer como una entrada
  suelta.

---

## 4. Campos del ingreso

**✅ Decidido.**

| Campo | Obligatorio | Notas |
|---|---|---|
| Proveedor | **Sí** | |
| Fecha de remisión | **Sí** | Fecha de entrega de la empresa |
| Nota de remisión | **Sí** | |
| Proceso Nº / C31 | **Sí** | |
| Fuente de financiamiento | **Sí** | Selector |
| Certificación | **Sí** | |
| Informe y/o acta de conformidad | **Sí** | Antes se llamaba «solicitud» |
| Fecha del informe / acta de conformidad | **Sí** | Fecha del documento anterior (agregado 2026-07-23) |
| Responsable de conformidad | **Sí** | Usuario con rol `solicitador` — ver punto 5 |
| Unidad solicitante | **Sí** | Solo para reportes; no afecta el stock |
| Nº de factura | No | |
| Observación | No | |

Además, automático y no editable: **fecha y hora de registro** y el usuario que
registró (auditoría).

**Sistema anterior**, para comparar: tiene los mismos cinco documentos de
respaldo (`NROFACTURA`, `NOTAREMISION`, `CERTIFICACION`, `PROCESO`,
`SOLICITUD`), todos opcionales. El 17% de los ingresos (3.958) no tiene número
de factura útil.

---

## 5. El «responsable»

**De qué se trata.** Quién firma el informe / acta de conformidad.

**Sistema anterior.** Sale de la tabla `personal`, que tiene **3.228
funcionarios**; se usaron 1.326 responsables distintos. No son usuarios del
sistema.

**✅ Decidido.** Sale de los **usuarios con rol `solicitador`**, y **solo de
ellos**, porque todos los funcionarios van a tener ese rol. Así no hace falta un
catálogo aparte de personal.

Consecuencia asumida: los jefes de unidad (rol `aprobador`) y los responsables de
almacén **no aparecen** en esa lista, porque un usuario tiene un solo rol. Si
alguna vez el acta la firma un jefe de unidad, habrá que ampliar la lista a todos
los usuarios activos — es un cambio de una línea, sin impacto en los datos.

**Etiqueta en el formulario:** «Responsable de conformidad», para no confundirlo
con el rol `responsable_almacen`.

---

## 6. La unidad solicitante

**✅ Decidido.** Es un selector obligatorio, pero **solo para reportes**: no
afecta el stock ni el almacén al que entra el material.

Vale tenerlo presente porque en el sistema anterior la unidad **era** el almacén;
en el nuevo son cosas separadas.

---

## 7. Las fechas

**Sistema anterior.** Tiene **una sola** columna `FECHA`, y es la que gobierna
todo el kardex (`YEAR(fecha) = gestión`, `fecha <= corte`). Los 22.850 registros
tienen hora `00:00:00`: es una fecha **tipeada por el usuario**, no el momento
del registro. No existe fecha de registro.

**✅ Decidido.** Dos fechas:

- **Fecha de remisión** — la escribe el usuario, es la del documento y **es la
  que manda** para el kardex y para determinar a qué gestión pertenece.
- **Fecha y hora de registro** — automática, nadie la edita, solo auditoría.

---

## 8. La numeración

**Sistema anterior.** El número lo genera el sistema así:

```sql
SELECT MAX(numeroingreso) + 1 FROM ingresosalmacenes WHERE idunidad = X
```

Filtra **solo por unidad**: ni gestión ni tipo. Consecuencias medidas:

- **No reinicia nunca.** La unidad 150 acumula hasta el 7.689 desde 2015.
- **Se duplica.** Al no estar en una transacción, dos usuarios simultáneos leen
  el mismo máximo: el **5,9%** de los números está repetido dentro de la misma
  unidad y gestión.
- Hay ingresos con número `0` (el cálculo falló).

El número solo se imprime en el documento; no interviene en ningún cálculo.

**✅ Decidido.** Reinicia **cada gestión y por almacén**, generado **dentro de la
transacción** (imposible duplicar). Formato visible: **`001/2026`** — correlativo
con ceros a la izquierda hasta 3 dígitos, barra, gestión de 4 dígitos.

Dos precisiones que quedan asentadas acá:

- **Si un almacén pasa de 999 ingresos en una gestión**, el número sigue creciendo
  a 4 dígitos (`1000/2026`); no se trunca ni se reinicia. Hoy no debería pasar: el
  almacén más movido del sistema anterior registró 468 ingresos en una gestión.
- **El número se repite entre almacenes**: el `001/2026` del Almacén Central y el
  del Almacén Regional son ingresos distintos. Es único por almacén + gestión. En
  los documentos impresos conviene que el nombre del almacén figure en el
  encabezado para que no haya ambigüedad.

---

## 9. El cierre de gestión

**Sistema anterior.** Hay un proceso automático por unidad
(`recaudacion/FrmProcesoCierreAlm.php` → `cierreAlmacenesUnidad(idunidad,
gestionAnterior, gestionNueva)`). Por cada lote con saldo mayor a cero crea un
**ingreso nuevo en la gestión siguiente**, copiando proveedor, fuente, factura,
certificación, proceso, nota de remisión y responsable. Comentario textual del
código:

> «Generamos registros de apertura en la tabla IngresosAlmacenes»

Efecto: cada gestión duplica los lotes vivos como ingresos nuevos. Por eso un
tercio de los ingresos de la base son aperturas.

**✅ Decidido.** El cierre **arrastra los saldos automáticamente**, pero sin
duplicar: el lote simplemente sigue vivo en la gestión siguiente. Así no se
infla la tabla ni se repiten facturas.

**⏳ Abierto** (del cuestionario): quién ejecuta el cierre y cuándo, y si la
gestión cerrada queda bloqueada para registrar movimientos con fecha anterior.

---

## 10. El IVA

**Sistema anterior.** Un único precio unitario, **sin desglose de IVA** — ni
siquiera existe el campo.

**✅ Decidido.** Igual: un solo campo de precio unitario, tal como figura en la
factura, con IVA incluido. Como institución pública no se recupera crédito
fiscal, el costo real del material es lo que se pagó, y ese es el valor que
corresponde en el kardex. Si algún día contabilidad necesita el neto, se
calcula; no se agregan campos por las dudas.

---

## 11. Cantidades y precios

**Sistema anterior.** `cantidad decimal(12,2)`, `PRECIOUNITARIO decimal(12,5)`,
`PRECIOTOTAL decimal(12,2)`. Y los usa: 2.903 líneas con cantidad no entera
(kilos, litros) y 2.760 con precio unitario de más de dos decimales.

**✅ Decidido.** Cantidades con 2 decimales; precio unitario con más precisión.

---

## 12. Anulación de un ingreso mal cargado

**✅ Decidido.** La hace el **`responsable_almacen`**, con motivo obligatorio.
Nunca se borra el registro.

**✅ Decidido.** **No se puede anular un ingreso del que ya salió material.** Si
alguno de sus lotes tiene movimientos, el sistema bloquea la anulación y hay que
anular primero esos egresos. Así ninguna salida queda apuntando a un lote
inexistente y el kardex no puede quedar inconsistente.

---

## 13. Migración de datos

**✅ Decidido.** **No hay migración.** Se hace un corte del sistema anterior un
mes antes de terminar el año y después se evalúa cómo pasar los saldos de esa
gestión.

**⏳ Abierto — y es importante.** Todos los campos obligatorios del ingreso
(proveedor, C31, certificación, nota de remisión) tienen sentido para una
compra, pero **los saldos que se pasen no tienen nada de eso**. Hace falta una
vía aparte, de administrador, para esa carga inicial. Si no, se repite el parche
del sistema anterior: crearon un proveedor ficticio llamado literalmente
**«SALDOS 2014»** para poder cargar los saldos, usado 232 veces.

Se resuelve junto con la definición del corte de gestión.

---

## Consecuencia para egresos (a confirmar con el encargado)

Al manejar el stock por lote, **cuando el responsable entregue material va a
tener que decidir de qué lote y de qué fuente sale**. El solicitante pide «20
resmas», pero alguien tiene que elegir de cuál compra se descuentan.

Propuesta: que el sistema sugiera automáticamente (lo más antiguo primero) y el
responsable pueda cambiarlo.

---

## Resumen de lo que falta para escribir el schema

Queda **una sola cosa**, y va con el encargado junto al corte de gestión:

- **La vía de carga inicial del arranque** (punto 13). Todos los campos
  obligatorios sirven para una compra, pero los saldos que se traigan del sistema
  anterior no tienen proveedor real, ni C31, ni certificación.

Todo lo demás está definido: **el módulo de ingresos está listo para escribir el
schema.** Se puede avanzar con el CRUD de fuentes de financiamiento y con el
ingreso completo; la carga inicial es una vía aparte que no bloquea nada de eso.
