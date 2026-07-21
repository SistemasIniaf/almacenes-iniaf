# Análisis del sistema de almacenes anterior

> Relevamiento hecho el **2026-07-21** sobre el código y el volcado de la base del
> sistema que el INIAF usa hoy. Sirve como referencia de negocio: cómo se opera
> realmente, qué datos existen y qué problemas conviene no repetir.
>
> Todo lo que dice "**dato:**" está verificado contra la base, no es suposición.

## Dónde están las fuentes (NO están en el repo)

| Qué | Ruta en la máquina de Sistemas |
|---|---|
| Código del sistema anterior | `C:\Users\SISTEMAS\Downloads\htdocs\` |
| Volcado de la base (86 MB, MySQL) | `C:\Users\SISTEMAS\Desktop\backup_db\semilla9_al.sql` |

No se suben al repo: el volcado pesa 86 MB y **la tabla `personal` guarda las
contraseñas en texto plano** (3.228 funcionarios). Están en `.gitignore`.

Los scripts que produjeron las cifras de este documento están en
`tools/analisis-legacy/`. Se ejecutan con `node <script>.js <ruta-al-dump.sql>`
y no necesitan levantar ninguna base: parsean el `.sql` como texto.

## El sistema anterior son DOS aplicaciones

Esto confunde al buscar código, así que conviene tenerlo claro:

| Aplicación | Ruta | Qué contiene |
|---|---|---|
| Yii 1.x | `htdocs/almacenes/protected/` | Egresos, aprobaciones, kardex, ítems, proveedores |
| PHP plano | `htdocs/htdocs/recaudacion/` | **Ingresos** y **proceso de cierre de gestión** |

Los ingresos NO tienen modelo en la app de Yii: se leen con SQL crudo desde
`extensions/Extiniaf.php` y se registran desde la app vieja (`ClsIngresosAlmacenes.php`).

## Volumen (gestiones 2015 a 2026)

| | |
|---|---|
| Ingresos | 22.850 |
| Líneas de ingreso (lotes) | 123.028 |
| Egresos | 38.594 |
| Líneas de egreso | 185.909 |
| Ítems en catálogo | 23.005 |
| Unidades | 179 |
| Fuentes de financiamiento | 93 registradas, 15+ con movimiento habitual |

Ritmo actual: ~2.900 ingresos y ~3.000 egresos por gestión.

## Modelo de datos

### `ingresosalmacenes` (cabecera)

`IDUNIDAD`, `IDPROVEEDOR`, `IDFONDO`, `NUMEROINGRESO`, `FECHA`, `OBSERVACION`,
`IDABIERTO`, `NROFACTURA`, `CERTIFICACION`, `PROCESO`, `NOTAREMISION`,
`SOLICITUD`, `IDRESPONSABLE`, `IDTIPODOCUMENTO`, `idunidadsol`.

**No existe la entidad "almacén"**: el ingreso se registra contra una unidad, o
sea que cada unidad administrativa funciona como su propio almacén. El sistema
nuevo separa las dos cosas.

### `ingresositems` (el lote)

`IDINGRESOALMACEN`, `IDITEMALMACEN`, `cantidad decimal(12,2)`,
`PRECIOUNITARIO decimal(12,5)`, `PRECIOTOTAL decimal(12,2)`, `SALDOCANTIDAD`.

### `egresositems`

`IDEGRESOALMACEN`, **`IDINGRESOITEM`** ← apunta al lote del que sale el material,
`cantidad`, `cantidadsolicitada`.

## Hallazgos

### 1. El stock se lleva por LOTE, no agregado

Cada línea de ingreso guarda su propio precio y su propio saldo. Cada línea de
egreso apunta al lote del que sale, y el kardex valoriza la salida con
`ei.cantidad * ii.preciounitario` — el precio **de ese lote**.

**Dato:** el 41% de los ítems se compró a más de un precio en la misma gestión
(el papel bond carta va de Bs 0 a Bs 111). El 2% de las salidas tomó de varios
lotes del mismo ítem, con un máximo de 70 lotes en un solo pedido.

### 2. Todo se segmenta por FUENTE DE FINANCIAMIENTO

`ingresosalmacenes.IDFONDO`. **Todas** las consultas del kardex la llevan en el
`WHERE`: no existe una vista consolidada, hay que elegir una fuente para ver el
kardex.

**Dato:** el 35% de los ítems se compró con más de una fuente. La gasolina
figura con 21 fuentes distintas; el papel bond, con 18. Las de mayor movimiento
son Recursos Específicos, Banco Mundial, COSUDE, DANIDA, KOPIA y los programas
TGN (trigo, papa, hortalizas, apícola, oleíferas, ganadería, granos andinos).

### 3. El kardex se calcula al vuelo

No hay tabla de movimientos: es un `UNION` entre ingresos y egresos filtrado por
`YEAR(fecha) = gestión`, en `Extiniaf.php::getListadoKardex()`.

### 4. Tres tipos de ingreso, y el segundo no es lo que parece

| Tipo (`IDTIPODOCUMENTO`) | Registros | c/factura | c/nota rem. | c/certif. | c/proceso |
|---|---|---|---|---|---|
| 37 — Ingreso (compra) | 15.433 | 86% | 30% | 73% | 24% |
| 39 — Ingreso saldos | 7.396 | 74% | 31% | 67% | 19% |
| 38 — Ingreso devolución | 21 | 10% | 0% | 0% | 5% |

**"Ingreso saldos" es la apertura de gestión**, no un tipo de documento real:
el 99,7% se carga en enero (7.371 de 7.396) y copia los datos del ingreso
original, por eso tiene factura.

**"Ingreso devolución" son correcciones de salidas**, no devoluciones al
proveedor. Textual de las observaciones: *"Combustible no retirado del
surtidor"*, *"Vale no retirado por vencimiento de la autorización"*,
*"reversión de 2 unidades de correa B-86 aprobadas en la salida erróneamente"*,
*"Vale anulado"*. Se usó 21 veces en 11 años y ninguna desde 2021.

### 5. El proceso de cierre de gestión (automático)

`recaudacion/FrmProcesoCierreAlm.php` → `cierreAlmacenesUnidad(idunidad, gestionAnterior, gestionNueva)`.

Por cada lote con `saldo > 0` crea un **ingreso nuevo en la gestión siguiente**
copiando proveedor, fuente, factura, certificación, proceso, nota de remisión y
responsable, marcado con `IDTIPODOCUMENTO = 39`. Comentario textual del código:
*"Generamos registros de apertura en la tabla IngresosAlmacenes"*.

Efecto: cada gestión duplica los lotes vivos como ingresos nuevos. Por eso un
tercio de los ingresos de la base son aperturas.

### 6. El número de ingreso: generado, pero sin garantías

```sql
SELECT MAX(numeroingreso) + 1 FROM ingresosalmacenes WHERE idunidad = X
```

Filtra **solo por unidad**: ni gestión ni tipo. Consecuencias medidas:

- **No reinicia nunca.** La unidad 150 acumula hasta el número 7.689 desde 2015.
- **Se duplica**: al no estar en una transacción, dos usuarios simultáneos
  obtienen el mismo número. El 5,9% de los números está repetido dentro de la
  misma unidad y gestión.
- Hay ingresos con número `0` (el cálculo falló).

El número solo se imprime; no interviene en ningún cálculo.

### 7. Una sola fecha, escrita a mano

La cabecera tiene únicamente `FECHA`, y es la que gobierna el kardex
(`YEAR(fecha) = gestión`, `fecha <= corte`).

**Dato:** los 22.850 registros tienen hora `00:00:00`, o sea que es una fecha
tipeada por el usuario, no el momento del registro. No existe fecha de registro.

### 8. `SALDOCANTIDAD` no es confiable

**Dato:** difiere del saldo calculado (cantidad − salidas) en **72.603 de
123.028 lotes (59%)**, y hay saldos negativos (−4, −5). Parte se explica porque
la columna es `int` mientras las cantidades tienen decimales; los negativos son
errores.

Es el argumento más fuerte para que en el sistema nuevo el saldo del lote se
mantenga dentro de la transacción que lo modifica, y que exista una tabla de
movimientos que permita recalcularlo.

### 9. El proveedor obligatorio forzó datos falsos

Los 22.850 ingresos tienen proveedor, porque el campo es obligatorio. Para poder
cargar los saldos iniciales crearon un proveedor llamado literalmente
**"SALDOS 2014"** (id 5293), usado 232 veces. También aparece un proveedor "N/A"
(900 usos en ingresos de saldos).

### 10. Otros datos que fijan tipos y decisiones

- **Cantidades con decimales**: 2.903 líneas no enteras (kilos, litros).
- **Precios con más de 2 decimales**: 2.760 líneas (`decimal(12,5)` se usa).
- **Sin IVA desglosado**: existe un único precio unitario, sin campo de impuesto.
- **Mínimos y máximos por ítem**: `itemsalmacenes.MINIMO` / `MAXIMO`, con reporte
  propio. Descartados para el sistema nuevo (decisión del 2026-07-21).
- **El egreso registra la actividad**: campo obligatorio de 200 caracteres, más
  una categoría.
- **El egreso tiene dos firmas**: `IDVERIFICADOR` e `IDAPROBADOR`, cada una con
  su fecha — coincide con el circuito de 2 niveles del sistema nuevo.
- **El responsable sale de `personal`** (3.228 funcionarios), no de los usuarios
  del sistema: se usaron 1.326 responsables distintos.
