# Egresos — decisiones y pendientes

> Fuente de verdad del módulo, igual que
> [`decisiones-ingresos.md`](decisiones-ingresos.md) lo es del suyo.
>
> El relevamiento del sistema anterior está en
> [`analisis-sistema-anterior.md`](analisis-sistema-anterior.md), secciones 11 y
> 12: la 11 sale del volcado de la base (38.594 egresos, 185.909 líneas,
> gestiones 2015–2026) y la 12, del código fuente de la app Yii.
>
> Las preguntas abiertas están en `preguntas-encargado-almacenes.docx`, Parte 3.

## Decidido

### 1. La numeración del egreso (2026-07-28)

**Igual que el ingreso**: correlativo que **reinicia cada gestión y por
almacén**, estampado **dentro de la transacción** que registra el egreso, y que
se imprime `001/2026` (`padStart(3)` + `/gestión`). No se guarda formateado.

No se copia el criterio del sistema anterior: su campo `PEDIDO` tiene **3,0% de
números repetidos** dentro de la misma unidad y gestión, y 1.521 egresos con
número cero o vacío — el mismo problema que ya se había medido en los ingresos.

### 2. Quien solicita es quien recibe (2026-07-28)

**No se separa el solicitante del receptor.** El sistema anterior guarda la
unidad y el funcionario por separado, y su impreso deja un recuadro «Recibido
Por» en blanco para que firme un tercero. Acá no: el egreso lo crea un usuario
con rol `solicitador`, que **ya tiene unidad y almacén fijos**, y esa persona es
la que retira el material.

Consecuencia para el impreso: el recuadro «Recibido por» sale con el nombre del
solicitante, no en blanco.

### 3. Un egreso puede mezclar fuentes de financiamiento (verificado, no hace falta preguntar)

Lo contestan los datos: el reporte «Solicitud de materiales» del sistema
anterior trae en un mismo pedido líneas de TGN Papa y Yuca, KOPIA y TGN
Ganadería. El egreso no se ata a una sola fuente, a diferencia del ingreso.

## Abierto — bloquea el modelo de datos

Estas cuatro cambian el esquema, así que se responden antes de escribir el
schema. Las demás preguntas de la Parte 3 (rechazo, cancelación, falta de stock,
saltar niveles, suplencia, plazos y anulación) son reglas del service: se pueden
confirmar después sin rehacer nada.

| # | Pregunta | Qué define |
|---|---|---|
| 10 | Cuántos niveles de aprobación | La máquina de estados y la tabla de historial |
| 11 | Quién elige el lote y la fuente | **La más estructural**: si elige el solicitante, la línea apunta a un lote desde que se crea; si elige el almacén al entregar, la línea nace apuntando a un ítem y recién al entregar se reparte en lotes |
| 12 | Si el pedido reserva stock | Si reserva, hay que representar la reserva; si no, no existe |
| 18 | Actividad y categoría | Si va la categoría, hace falta su catálogo (CRUD + seed con las 9 existentes) |

### Lo que ya sabemos de cada una (del sistema anterior)

- **Niveles**: allá son CUATRO pasos con pantalla y rol propios, pero el **81,5%**
  de los egresos firmados tiene a la misma persona en los tres casilleros y el
  86,3% tiene el mismo verificador que aprobador. Los rechazos son 505 en once
  años (1,3%).
- **Lote y fuente**: los elige el **solicitante**, sobre un selector que lista
  lotes (`02/01/2026-PAPEL BOND A3 Saldo:1.00 TGN APICOLA`) y que **ofrece lotes
  agotados** — de ahí los saldos negativos de esa base.
- **Reserva**: allá reserva **de hecho** desde que se graba el pedido, porque el
  saldo resta todas las líneas sin mirar el estado. El rechazo libera poniendo
  las cantidades en cero.
- **Actividad**: texto libre de 200 caracteres (se llena en el 63,9%, mediana 48
  caracteres) más una **categoría** de 9 valores que el impreso llama
  «Programa».
