# Plan de pruebas manuales — recorrido completo del sistema

Recorrido de punta a punta con **2 almacenes** (OFICINA NACIONAL y ODS LA PAZ) y los **8 ítems**
del catálogo, pensado para que al final los reportes tengan datos parecidos a los reales: el
mismo ítem comprado a **dos precios** y con **dos fuentes**, saldo que viene de la **gestión
anterior**, entregas parciales, un rechazo y una anulación.

Los importes están elegidos para poder verificarlos de memoria. Al final hay una tabla de cuadre:
si esos números salen, el circuito está sano.

Base de partida: la de desarrollo, con ingresos y egresos borrados (2026-08-03).

---

## Antes de empezar

```powershell
# Postgres (si no está levantado)
docker compose up -d

# Backend  → http://localhost:3000
cd backend ; pnpm dev

# Frontend → http://localhost:5173
cd frontend ; pnpm dev
```

> **No corras `pnpm seed:dev`.** Siembra almacenes y unidades ficticios («Almacén Central», «UP»,
> «UAF») que se mezclarían con el organigrama real del INIAF que ya está cargado.

### Lo que ya está cargado

**Ítems (8, en 5 partidas)** — todos con foto:

| Código | Descripción | Unidad | Partida |
|---|---|---|---|
| `32100-000001` | PAPEL BOND T/CARTA | PAQUETE | 32100 · Papel |
| `32100-000002` | PAPEL BOND T/OFICIO | PAQUETE | 32100 · Papel |
| `32200-000001` | CAJAS DE CARTON GRANDE | PIEZA | 32200 · Productos de Artes Gráficas |
| `33400-000001` | BOTAS DE AGUA | PAR | 33400 · Calzados |
| `39500-000001` | BOLIGRAFO COLOR AZUL | PIEZA | 39500 · Útiles de Escritorio y Oficina |
| `39500-000002` | BOLIGRAFO COLOR ROJO | PIEZA | 39500 · Útiles de Escritorio y Oficina |
| `39500-000003` | BOLIGRAFO COLOR NEGRO | PIEZA | 39500 · Útiles de Escritorio y Oficina |
| `39700-000001` | FOCO LED 12W | PIEZA | 39700 · Útiles y Materiales Eléctricos |

**Los dos almacenes de la prueba y su gente:**

| Almacén | Responsable | Aprobador (unidad) | Solicitadores |
|---|---|---|---|
| **1 · OFICINA NACIONAL** | `resp.nacional` | `aprob.upgi` (`UPGI/`) | `john.ticona`, `gonzalo.aruquipa`, `nelson.paredes`, `pedro.ferrano` — todos `UPGI/` |
| **2 · ODS LA PAZ** | `resp.lapaz` | `aprob.lapaz` (`DNS/ODS-LP/`) | `yoselin.callisaya` (`DNS/ODS-LP/`) |

> `resp.lapaz` y `yoselin.callisaya` son **dos cuentas de la misma persona** con roles distintos.
> Está bien, pero no las confundas al mirar el historial.

El tercer almacén (**ODS POTOSÍ**) queda fuera del recorrido: no tiene usuarios. Dejalo como está —
sirve para comprobar que un almacén vacío no rompe listados ni reportes.

Además: 55 unidades, 505 partidas, 4 proveedores (PAPELBOL, KAUTSCH, HORTITEC, DISTRIBUIDORA LA PAZ)
y 37 fuentes de financiamiento.

---

## Fase 0 · Un arreglo previo, si no lo hiciste ⚠️

La unidad de la gente de La Paz es **`DNS/ODS-LP/`**, pero esa unidad **no figura entre las que
ofrece el almacén 2** (hoy tiene `DNS/CCSAT/`, `DNS/FRS/`, `DNS/UCS/` y `OTRO`).

- [ ] **Almacenes → ODS LA PAZ → vincular `DNS/ODS-LP/`.**

Sin esto, al registrar el ingreso de La Paz el selector de «unidad solicitante» no la ofrece. Los
egresos igual funcionan (la unidad la heredan del solicitante, no pasa por ahí), así que el síntoma
aparece solo en el ingreso y despista.

---

## Fase 1 · Lo que falta crear

- [ ] **Un `observador_almacen`** (ej. `observa.todo`) con los **dos** almacenes marcados. Es el
      único rol que hoy no tiene ningún usuario: sin esto queda sin probar.

**Probá de paso las reglas de unicidad** — tienen que fallar con mensaje claro, no con error de base:

- [ ] Crear un segundo aprobador activo en `UPGI/` → debe rechazarlo.
- [ ] Crear un segundo responsable activo en OFICINA NACIONAL → debe rechazarlo.
- [ ] Crear un `solicitador` sin cargo → debe exigirlo (obligatorio salvo admin/super_admin).
- [ ] Intentar desactivar tu propia cuenta → el botón debe estar deshabilitado.
- [ ] Elegir rol `solicitador`, cargar unidad, cambiar a `admin` y guardar → **no debe viajar** la
      unidad vieja (el payload se arma según el rol, no según lo que quedó en pantalla).

---

## Fase 2 · Ingresos

Registrá cada uno como el **responsable de ese almacén**. Los respaldos (nota de remisión, C31,
certificación, informe de conformidad, factura) son **obligatorios**: poné cualquier valor, pero
probá primero **dejar uno vacío** y verificá que el backend liste exactamente qué falta.

### Almacén 1 · OFICINA NACIONAL — usuario `resp.nacional`

**ING-A** · fuente `REC. ESPECÍFICOS` · proveedor **PAPELBOL** · unidad solicitante `UPGI/`

| Ítem | Cant. | P. unit. | Subtotal |
|---|---|---|---|
| PAPEL BOND T/CARTA | 100 | 25,00 | 2.500,00 |
| PAPEL BOND T/OFICIO | 50 | 30,00 | 1.500,00 |
| | | **TOTAL** | **4.000,00** |

**ING-B** · fuente `BANCO MUNDIAL` · proveedor **KAUTSCH** · unidad `UPGI/`

| Ítem | Cant. | P. unit. | Subtotal |
|---|---|---|---|
| PAPEL BOND T/CARTA | 60 | 28,00 | 1.680,00 |
| BOLIGRAFO COLOR AZUL | 200 | 3,50 | 700,00 |
| | | **TOTAL** | **2.380,00** |

> El **mismo papel carta con otro precio y otra fuente** es a propósito: así el stock muestra 2 lotes
> del mismo ítem y los reportes se separan por fuente. Es el caso real — el 41% de los ítems se
> compró a más de un precio en la misma gestión.

**ING-C** · fuente `TGN` · proveedor **HORTITEC** · unidad `UPGI/`

| Ítem | Cant. | P. unit. | Observación de línea | Subtotal |
|---|---|---|---|---|
| BOTAS DE AGUA | 10 | 120,00 | `TALLA 42` | 1.200,00 |

### Almacén 2 · ODS LA PAZ — usuario `resp.lapaz`

**ING-D** · fuente `REC. ESPECÍFICOS` · proveedor **DISTRIBUIDORA LA PAZ** · unidad `DNS/ODS-LP/`

| Ítem | Cant. | P. unit. | Subtotal |
|---|---|---|---|
| CAJAS DE CARTON GRANDE | 200 | 5,00 | 1.000,00 |
| FOCO LED 12W | 40 | 18,00 | 720,00 |
| | | **TOTAL** | **1.720,00** |

**ING-E** · fuente `BANCO MUNDIAL` · proveedor **PAPELBOL** · unidad `DNS/ODS-LP/`

| Ítem | Cant. | P. unit. | Subtotal |
|---|---|---|---|
| PAPEL BOND T/CARTA | 80 | 26,00 | 2.080,00 |
| BOLIGRAFO COLOR ROJO | 100 | 3,50 | 350,00 |
| | | **TOTAL** | **2.430,00** |

**Total institucional: 11.730,00 Bs.**

### 2.1 Verificaciones de ingreso

- [ ] El **número se estampa solo** y arranca en `001/2026` **en cada almacén**: el correlativo es
      por almacén, así que los dos tienen su propio `001`.
- [ ] El selector de ítem **busca contra el servidor**: escribí `boli` y comprobá que filtra sin
      acentos y que no trae el catálogo entero.
- [ ] **Imprimir ING-A**: el PDF abre con membrete INIAF/Ministerio, la fecha de ingreso pegada al
      número y el monto en letras. En **ING-C** el detalle debe decir `BOTAS DE AGUA (TALLA 42)`.
- [ ] Abrir ING-A y **editar la factura** → guarda. Comprobá que **líneas, almacén, fuente y fecha
      de remisión quedan bloqueados** (para corregir eso hay que anular y registrar de nuevo).
- [ ] `resp.nacional` **no debe ver** los ingresos del almacén 2. Y `resp.lapaz`, ninguno del 1.

### 2.2 Saldo que viene de la gestión anterior ⭐

Es el paso más valioso del recorrido: habilita el «saldo inicial» de los cuadros contables y la
línea de apertura del kardex. **La fecha de ingreso la pone el backend y solo `super_admin` la
corrige.**

- [ ] Entrar como **`superadmin`**, abrir **ING-C** y cambiar la **fecha de ingreso** a `15/12/2025`.
- [ ] Verificar que **se re-estampó el número**: pasa a la serie de 2025, porque el número que tenía
      era de la secuencia 2026 y ahí no vale.
- [ ] Verificar en el **kardex de BOTAS DE AGUA** que ese movimiento ya no aparece en 2026 y que las
      10 unidades salen como **saldo de apertura**.
- [ ] Intentar la misma edición como `resp.nacional` → debe responder **403**.
- [ ] Intentar poner una fecha **futura** → debe rechazarla.

---

## Fase 3 · Consultas y reportes (con stock intacto)

Hacelo **antes** de los egresos, así tenés el «antes» para comparar.

- [ ] **Stock**: desplegá PAPEL BOND T/CARTA en el almacén 1 → **2 lotes** (25,00 rec. específicos y
      28,00 banco mundial), del **más antiguo primero**.
- [ ] Filtrá por fuente `BANCO MUNDIAL` → el saldo del ítem debe **recalcularse a 60**, no solo
      esconder el otro lote.
- [ ] Sin filtro de almacén, el papel carta debe sumar **240** (100 + 60 + 80 de La Paz).
- [ ] Los tres bolígrafos son ítems distintos en la **misma partida** (`39500`): comprobá que la
      pantalla los agrupa bajo un solo encabezado de partida.
- [ ] **Kardex** de PAPEL BOND T/CARTA en almacén 1 → 2 entradas, saldo corriente 100 → 160.
      Probá el atajo **«Ver kardex»** desde la fila de stock (debe llevar ítem y almacén por la URL).
- [ ] Reporte **Estado de almacenes** (detalle por fuente y partida) y **Estado consolidado**
      (resumen por partida). **Los totales tienen que coincidir**: son la misma plata reagrupada.
- [ ] Sacá el consolidado **sin filtrar almacén**: debe titularse «NACIONAL» y sumar los dos.
- [ ] Verificá que **ODS POTOSÍ**, sin movimientos, no rompe ni el listado ni los reportes.

---

## Fase 4 · Egresos (el circuito completo)

Recordá: **el almacén del pedido sale del solicitante**, no se elige. Y el pedido apunta a un
**lote concreto**, no a un ítem.

### EG-1 · Camino feliz — almacén 1

- [ ] `john.ticona`: nuevo pedido, **lote de ING-A** (papel carta a 25,00), **30 paquetes**.
      Justificación obligatoria.
- [ ] Comprobá que el selector muestra la **foto del ítem** y la etiqueta `descripción — disp. N
      unidad` + la fuente. Ampliá la foto con el diálogo.
- [ ] Guardar → queda en «Pendiente de envío», **todavía sin número**.
- [ ] Desde el listado: **enviar** (ícono ➤). El diálogo debe **nombrar al aprobador** (PEDRO
      FERRANO). Confirmar → ahí recién se estampa el número.
- [ ] `aprob.upgi`: entra y el listado abre en **su bandeja**; aprueba.
- [ ] `resp.nacional`: entrega **30** → salida de **750,00**, valorizada al precio de ESE lote.
- [ ] Ver el **historial** (ícono ⏱ del listado): debe narrar acciones («Aprobó el pedido»), no estados.
- [ ] **Imprimir** el pedido: se abre en un visor dentro de la app, apaisado, con el pie de 3
      casillas (*Aprobador de Unidad · Encargado de Almacenes · Recibí conforme*).

### EG-2 · Rechazo y entrega parcial — almacén 1

- [ ] `gonzalo.aruquipa`: pedido con **2 líneas** → lote de ING-B (papel carta a 28,00) **10** +
      BOLIGRAFO COLOR AZUL **20**. Enviar.
- [ ] `aprob.upgi`: **rechaza** con motivo.
- [ ] Verificar que **vuelve a «Pendiente de envío» pero conserva el número** (ya es un documento).
- [ ] `gonzalo.aruquipa`: corrige el papel a **8** y reenvía.
- [ ] `aprob.upgi` aprueba → comprobá que el aprobador **no puede tocar cantidades**.
- [ ] `resp.nacional`: entrega **8 papel y 12 bolígrafos** (parcial). El pedido queda entregado con
      la cantidad ajustada.

### EG-3 · La reserva ⭐ — almacén 1

- [ ] `nelson.paredes`: pedido del lote de ING-A, **20 paquetes**. **Guardar y NO enviar.**
- [ ] Con `pedro.ferrano`, abrir un pedido nuevo del **mismo lote**: el disponible debe mostrar
      **50** (70 de saldo − 20 reservados por el borrador ajeno), no 70.

> La reserva no es una columna: se deriva de las líneas de pedidos pendientes y de los borradores de
> menos de 48 h. Por eso descartar el borrador **libera solo**, sin proceso de limpieza.

- [ ] Pedir **más de lo disponible** → lo rechaza el backend al guardar (el aviso rojo en pantalla es
      solo un aviso, la barrera está del otro lado).
- [ ] Intentar **repetir el mismo lote en dos líneas** → el selector directamente no debería
      ofrecerlo en la segunda.
- [ ] Guardar con el formulario incompleto (sin líneas) → debe avisar con un toast, no quedarse mudo.
- [ ] **Descartar** el borrador → desaparece de verdad (es lo único que se borra en el sistema) y el
      disponible vuelve a 70.

### EG-4 y EG-5 · Almacén 2

- [ ] **EG-4** (`yoselin.callisaya`): CAJAS DE CARTON GRANDE **50** → enviar → `aprob.lapaz` aprueba
      → `resp.lapaz` entrega. Ciclo completo.
- [ ] **EG-5** (`yoselin.callisaya`): PAPEL BOND T/CARTA del lote de ING-E, **20** → ciclo completo
      hasta entregar, y después **anularlo** con motivo → el stock debe **volver a 80** y quedar un
      movimiento de **REVERSIÓN** en el kardex.

### 4.1 Alcance y permisos

- [ ] `john.ticona` ve **solo sus propios** pedidos (no los de gonzalo, aunque compartan unidad).
- [ ] `aprob.upgi` ve los de **toda su unidad**, y ninguno del almacén 2.
- [ ] `resp.lapaz` no ve nada del almacén 1.
- [ ] El **botón de imprimir** aparece para `resp.nacional`/admin, **no** para el solicitante ni el
      aprobador.
- [ ] `observa.todo` ve los dos almacenes y **no puede tocar nada**.
- [ ] Un pedido en «Pendiente de envío» **no se imprime** (no tiene número).
- [ ] En el listado del almacén 1, el `solicitador` **no debería ver la columna Solicitante** (sería
      su nombre repetido en cada fila).
- [ ] La palabra **«borrador» no debe aparecer en ninguna pantalla** — los estados en curso se leen
      «Pendiente de envío / de aprobación / de entrega».

---

## Fase 5 · Anulaciones e integridad

- [ ] Intentar **anular ING-A** → debe **bloquearlo**: su lote ya tuvo salidas (EG-1).
- [ ] Registrar un ingreso suelto, sin egresos, y anularlo → el saldo del lote va a **0** y aparece
      una **REVERSIÓN** en el kardex.
- [ ] Imprimir un ingreso anulado → **marca de agua** cruzada y quién lo anuló al pie.
- [ ] Confirmar que **no existe** forma de borrar un ingreso.

---

## Fase 6 · Cuadre final

### Stock esperado — almacén 1

| Ítem | Lote (fuente · precio) | Ingresó | Salió | Saldo |
|---|---|---|---|---|
| PAPEL BOND T/CARTA | ING-A · rec. específicos · 25,00 | 100 | 30 | **70** |
| PAPEL BOND T/CARTA | ING-B · banco mundial · 28,00 | 60 | 8 | **52** |
| PAPEL BOND T/OFICIO | ING-A · rec. específicos · 30,00 | 50 | — | **50** |
| BOLIGRAFO COLOR AZUL | ING-B · banco mundial · 3,50 | 200 | 12 | **188** |
| BOTAS DE AGUA | ING-C · TGN · 120,00 (gestión **2025**) | 10 | — | **10** |

### Stock esperado — almacén 2

| Ítem | Lote (fuente · precio) | Ingresó | Salió | Saldo |
|---|---|---|---|---|
| CAJAS DE CARTON GRANDE | ING-D · rec. específicos · 5,00 | 200 | 50 | **150** |
| FOCO LED 12W | ING-D · rec. específicos · 18,00 | 40 | — | **40** |
| PAPEL BOND T/CARTA | ING-E · banco mundial · 26,00 | 80 | 20 → anulado | **80** |
| BOLIGRAFO COLOR ROJO | ING-E · banco mundial · 3,50 | 100 | — | **100** |

*BOLIGRAFO COLOR NEGRO queda sin movimientos: sirve para verificar que un ítem en cero no aparece
en stock salvo que destildes «solo con saldo».*

### Comprobaciones que atan todo

- [ ] **Estado de almacenes** y **Estado consolidado** dan el **mismo total**.
- [ ] El **saldo final del kardex** de cada ítem coincide con lo que muestra la pantalla de stock.
- [ ] El total sin filtrar almacén = suma de los dos almacenes por separado.
- [ ] Ningún saldo **negativo** en ningún lote. *(Era el defecto del sistema anterior: 59% de sus
      lotes desincronizados. Si aparece uno acá, es un bug real y hay que reportarlo.)*

---

## Lo que este recorrido **no** puede probar todavía

- **Los Cuadros 5 y 6 (DGCF R1.05 / R1.06)** — no están construidos. El recorrido deja los datos
  listos para cuando se hagan: el paso 2.2 crea saldo de 2025 que sirve de «saldo inicial al 01/01»,
  y los movimientos de 2026 alimentan las columnas de entradas y salidas.
- **Cierre de gestión** y **carga inicial de saldos del sistema anterior**: pendientes de definir
  (`docs/decisiones-ingresos.md`, puntos 9 y 13).
- **Devoluciones** de material ya retirado: sin confirmar si hacen falta.

---

## Si querés volver a empezar de cero

Borra ingresos y egresos dejando intactos catálogos, usuarios y almacenes:

```powershell
docker exec almacenes_db_dev psql -U postgres -d almacenes_db -c "TRUNCATE movimientos_kardex, egreso_historial, egreso_detalles, egresos, ingreso_detalles, ingresos RESTART IDENTITY;"
```

No toca `Partida.ultimoCorrelativo` — y no hay que tocarlo: los ítems ya creados conservan sus
códigos y resetearlo generaría duplicados.
