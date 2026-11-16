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
| Responsable / Comisión de recepción | **Sí** | Usuario con rol `solicitador` — ver punto 5 |
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

**Etiqueta en el formulario — corregida el 2026-07-27:** «Responsable / Comisión
de recepción». Antes decía «Responsable de conformidad»; la institución aclaró
que el nombre correcto es *responsable de recepción* cuando firma una persona y
*comisión de recepción* cuando lo hace un cuerpo colegiado (es la distinción de
la normativa de contrataciones según el monto). La etiqueta cubre los dos casos
y sigue sin confundirse con el rol `responsable_almacen`.

**En la base y en la API el campo se sigue llamando `responsableConformidadId`**:
renombrarlo pide una migración y no le cambia nada al usuario.

⏳ **Abierto:** el sistema guarda **un** usuario. Si la comisión de recepción es
de varias personas y las tres tienen que figurar en la nota impresa, hace falta
pasar el campo a una relación muchos-a-muchos.

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

**✅ Decidido — CORREGIDO el 2026-07-29.** Ahora son **tres** fechas, y la que
manda ya no la escribe nadie.

> La decisión anterior (2026-07-24) era: «la fecha de remisión es la que manda
> para el kardex y para determinar la gestión». **Se cambió**: la escribe a mano
> el responsable de almacén, así que un error de tipeo en el año mandaba el
> ingreso a otra gestión, le daba un correlativo de esa otra secuencia y
> descolocaba el libro. Repetía el defecto del sistema anterior, solo que con
> otro nombre de columna.

| Fecha | Quién la pone | Qué gobierna |
|---|---|---|
| **`fechaIngreso`** | el sistema, al registrar | **Todo**: la gestión (y con ella el correlativo), la fecha del movimiento de Kardex y el orden en que se consumen los lotes |
| **`fechaRemision`** | el usuario | Nada. Es el dato del documento del proveedor: se sigue pidiendo, mostrando e imprimiendo |
| **`createdAt`** | el sistema | Nada. Auditoría pura, nunca se corrige |

**La corrección de `fechaIngreso` es exclusiva del `super_admin`** (el resto
recibe 403). El caso previsto es el cierre de gestión: material que entró el
28/12 y se registró el 2/1. No se admite fecha futura.

Esa corrección arrastra tres cosas y por eso va en **una sola transacción**:
mueve la fecha de los movimientos de Kardex y, **si cae en otra gestión,
re-estampa el correlativo** — el número se había asignado en la secuencia de la
gestión anterior y ahí no vale (`@@unique([almacenId, gestion, numero])`).
Consecuencia asumida: corregir de gestión **cambia el número impreso** del
ingreso.

Migración: `20260729190000_ingreso_fecha_propia`. Los ingresos ya registrados
conservan exactamente su comportamiento: su `fechaIngreso` se pobló con su
`fechaRemision`, que es de donde habían salido su gestión y su Kardex.

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

**Lo que el código del sistema anterior muestra** (`ClsFuncionesGenerales.php`,
`cierreAlmacenesUnidadNuevo`, leído el 2026-11-11): se corre a mano, almacén por
almacén; el saldo lo calcula restando TODAS las salidas del lote sin mirar el
estado del egreso (la versión anterior de la consulta filtraba aprobados y ese
filtro se perdió); numera las aperturas desde 1 salteando el `MAX+1`; no es
transaccional (si se corta, no se puede repetir: el único control es «¿ya hay
ingresos de saldos este año?»); y la marca de cerrado (`idabierto = 36`) no la
consulta ninguna pantalla, así que no bloquea nada.

**✅ Decidido (2026-11-12, con el usuario):**

- **Se cierra almacén por almacén**, con un **botón** en una pantalla de
  Administración, no automático por fecha: en enero hace falta margen para
  corregir lo que entró a fin de año y se registró después.
- **Solo el `super_admin`** ejecuta el cierre.
- **Sin plazo** (2026-11-16, reemplaza la ventana de «las dos primeras semanas
  de enero»): el sistema detecta solo qué gestión le falta cerrar a cada almacén
  (la más antigua abierta, nunca una futura) y se cierra cuando se quiera — en
  enero, en marzo o años después. **En orden**: no se cierra 2027 con 2026
  abierta. Cerrar tarde no molesta: mientras la gestión anterior siga abierta,
  la nueva funciona normal, y la foto se reconstruye del kardex al 31/12.
  Se puede cerrar también la **gestión en curso** (pensado para pruebas): el
  almacén queda congelado hasta el 1/1, porque todo lo que se hiciera quedaría
  fechado en la gestión cerrada. Se acepta el riesgo porque solo lo hace el
  `super_admin`.
- **No se cierra con pedidos de esa gestión abiertos** (2026-11-16): todo pedido
  con número de la gestión tiene que estar ENTREGADO o DESISTIDO. No traban los
  pedidos de la gestión siguiente ni los «Pendiente de envío» (no tienen número
  y su reserva vence sola; no tocan el kardex). Si el aprobador o el solicitante
  no están, el `super_admin` ya puede devolver y desistir.
- **Un pedido se entrega en su gestión o no se entrega** (2026-11-16): desde el
  1/1, un pedido con número de la gestión anterior que siga abierto solo se puede
  devolver y desistir — ni aprobar, ni reenviar, ni entregar.
- **Una gestión cerrada NO se reabre y queda CONGELADA** (2026-11-16): nada de
  esa gestión en ese almacén se anula ni se edita — ingresos (anulación, edición
  de cabecera, corrección de `fechaIngreso` desde o hacia ella), egresos
  entregados (anulación) y saldos iniciales (anulación o importación con fecha de
  corte en ella). Se descartó permitir anular con reversión fechada en la gestión
  nueva. Los LOTES siguen usándose normalmente: lo congelado son los documentos.
- **NO hay recuento físico** al cierre (decidido con el encargado el
  2026-11-16; el 2026-11-12 se había dicho que sí). Por eso **no se construye
  el ajuste de inventario** y el cierre no exige ningún recuento previo: la foto
  al 31/12 es la del sistema tal como quedó.
- Al cerrar se guarda una **foto de los saldos al 31/12** por lote, calculada
  desde el kardex, y quedan descargables (siempre desde la foto, no del stock del
  día): **acta de cierre** (PDF) y los **Cuadros 5 y 6 de la DGCF** del almacén
  (PDF y Excel). Además un **Cuadro 5/6 institucional** que suma las fotos de
  todos los almacenes, marcado «PROVISIONAL» mientras falte cerrar alguno, y
  donde los traspasos entre almacenes se descuentan (son internos).
- **Cuadros 5 y 6** (2026-11-16): son un **modelo** para que almacenes llene el
  formulario que le manda el Ministerio, no el documento oficial. Cuadro 6: **una
  fila por ítem + precio** (cuadra exacto con los lotes). Cuadro 5: por la
  **partida del ítem** (la hoja, ej. 32100). Entradas = ingresos y traspasos
  recibidos menos ingresos anulados en la gestión; salidas = entregas y traspasos
  enviados menos egresos anulados. **Firmas: pendientes** (las define el
  Ministerio).

**No hace falta «abrir» la gestión nueva**: los lotes siguen vivos, el saldo de
apertura del kardex se calcula y los correlativos arrancan solos en 001.

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

**✅ Decidido (2026-11-12): vía híbrida script → planilla → importación.** El
catálogo de ítems del sistema nuevo se arma **desde cero**, así que ningún script
puede saber solo a qué ítem nuevo corresponde cada viejo. Un script
(`tools/migracion-saldos/`) extrae del volcado los lotes con saldo ya llenos y la
persona solo completa la correspondencia de almacén, fuente e ítem. Después una
pantalla de `super_admin` la importa. A mano (~3.100 lotes) o por Excel en blanco
se descartaron: es volver a tipear lo que ya está en la base.

Cifras del volcado al 6/11/2026: **3.097 lotes con saldo, 1.907 ítems** (de
23.071), 23 almacenes viejos, 26 fuentes (todas con correspondencia por nombre en
las del seed), 79 lotes con más salidas que ingreso. **Valor Bs 45,4 millones,
de los cuales 42,3 son del almacén OLEÍFERAS**, casi todo semilla de palma
aceitera arrastrada de gestiones anteriores — a confirmar con el encargado antes
de migrarla.

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
