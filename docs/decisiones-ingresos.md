# Ingresos — decisiones tomadas y pendientes

> Estado al **2026-07-21**. Las decisiones vienen de la consulta al encargado de
> almacenes, contrastadas con el sistema anterior (ver
> [analisis-sistema-anterior.md](analisis-sistema-anterior.md)).
>
> El cuestionario completo para la reunión está en
> `preguntas-encargado-almacenes.docx`.

## ✅ Decidido

### Modelo de stock

- **Por LOTE.** Cada línea de ingreso conserva su precio y su saldo propio. Las
  salidas se descuentan de lotes concretos y se valorizan al precio de ese lote.
  (Igual que el sistema anterior; ver hallazgo 1 del análisis.)
- **Separado por FUENTE DE FINANCIAMIENTO.** Es el nombre definitivo — en el
  sistema anterior se llamaba "fondo". Cada lote pertenece a una fuente y el
  saldo de un ítem se lee por fuente.
- La fuente de financiamiento es un **CRUD propio** (catálogo administrable).
- **Una sola fuente por ingreso** (va en la cabecera, no por línea).

### Campos del ingreso

| Campo | Obligatorio | Notas |
|---|---|---|
| Proveedor | Sí | |
| Fecha de remisión | Sí | Fecha de entrega de la empresa. La escribe el usuario y **es la que gobierna el kardex y la gestión**. |
| Nota de remisión | Sí | |
| Proceso Nº / C31 | Sí | |
| Fuente de financiamiento | Sí | Selector |
| Certificación | Sí | |
| Informe y/o acta de conformidad | Sí ⟵ *confirmar* | Antes se llamaba "solicitud" |
| Responsable | Sí | Usuario con rol `solicitador` (ver pendiente 3) |
| Unidad solicitante | Sí | Solo para reportes; no afecta el stock |
| Nº de factura | No | |
| Observación | No | |

Además, automático y no editable: **fecha y hora de registro** (auditoría) y el
usuario que registró.

### Otras reglas

- **No hay tipo de ingreso.** Se elimina la distinción compra / saldos /
  devolución del sistema anterior:
  - "Ingreso saldos" existía solo porque el arrastre de gestión creaba ingresos
    nuevos. Con el cierre automático el lote **sigue vivo** en la gestión
    siguiente, sin duplicarse.
  - "Ingreso devolución" eran correcciones de salidas; eso lo resuelve la
    **anulación de egreso** (reversión al lote original, con motivo y
    responsable).
- **Numeración**: reinicia cada gestión, por almacén, generada **dentro de la
  transacción** (en el sistema anterior se calculaba con `MAX+1` y se duplicaba
  el 5,9% de las veces).
- **Precios**: un único precio unitario, tal como figura en la factura, con IVA
  incluido. Sin desglose de impuesto (la institución no recupera crédito fiscal).
- **Cantidades**: decimales (2), precio unitario con más precisión (5).
- **Anulación**: la hace el `responsable_almacen`, con motivo obligatorio.
- **Cierre de gestión**: arrastra los saldos automáticamente.
- **Sin mínimos ni máximos por ítem** (existen en el sistema anterior; se
  descartan).
- **Migración**: no se migra. Se corta el sistema anterior un mes antes de fin de
  año y después se evalúa cómo pasar los saldos de esa gestión.

## ⏳ Pendiente de definir

1. **Formato visible del número de ingreso.** Reinicia por gestión y almacén,
   pero falta definir cómo se imprime: `001/2026`, `CENTRAL-2026-0001`, u otro.
   Va en documentos físicos.

2. **Anulación con movimientos.** ¿El `responsable_almacen` puede anular un
   ingreso del que **ya salió material**? Propuesta: bloquearlo y exigir que
   primero se anulen esos egresos, para que el kardex no quede inconsistente.

3. **Alcance de la lista de "responsable".** Se definió que salga de los usuarios
   con rol `solicitador`. Ojo: un usuario tiene un solo rol, así que **no van a
   aparecer** los jefes de unidad (`aprobador`) ni los responsables de almacén.
   Si el acta de conformidad la puede firmar un jefe de unidad, la lista debería
   ser "todos los usuarios activos".

4. **¿"Informe y/o acta de conformidad" es obligatorio?** Se asumió que sí.

5. **La carga inicial del arranque.** Todos los campos obligatorios (proveedor,
   C31, certificación, nota de remisión) tienen sentido para una compra, pero el
   día que arranque el sistema hay que cargar los saldos existentes, que no
   tienen nada de eso. Necesita una vía aparte de administrador — si no, se
   repite el parche del proveedor ficticio "SALDOS 2014".
   Se resuelve junto con el corte de gestión.

6. **Catálogo de fuentes de financiamiento**: qué campos lleva además del nombre
   (¿código?, ¿vigencia por gestión?).

## Consecuencia para egresos (a confirmar con el encargado)

Al manejar el stock por lote, **cuando el responsable entregue material va a
tener que decidir de qué lote y de qué fuente sale**. El solicitante pide "20
resmas", pero alguien tiene que elegir de cuál compra se descuentan.

Propuesta: que el sistema sugiera automáticamente (lo más antiguo primero) y el
responsable pueda cambiarlo.
