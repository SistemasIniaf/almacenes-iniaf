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

### 4. El circuito: dos niveles (2026-07-29, respuesta del encargado)

```
El solicitante crea el pedido
   │ envía
   ▼
Jefe de su unidad (rol `aprobador`)        → aprueba o RECHAZA. No toca cantidades.
   ▼
Responsable del almacén                    → aprueba, AJUSTA cantidades y entrega.
   │                                          Descarga el stock y genera la SALIDA de Kardex.
   ▼
Entregado
```

**Quién puede tocar las cantidades — importante, corrige lo que se había
asumido**: solo el **responsable de almacén**, y el **solicitante** cuando le
rechazaron el pedido y lo está corrigiendo. El jefe de unidad **no ajusta nada**:
aprueba o rechaza.

> La máquina de estados de `CLAUDE.md` decía «aprueba (puede ajustar cantidad)»
> también en el nivel del aprobador. Quedó corregida.

Se descarta el circuito del sistema anterior (cuatro pasos): allá el 81,5% de los
egresos firmados tiene a la misma persona en los tres casilleros.

---

### 5. El solicitante elige el lote y la fuente (2026-07-29)

Es lo mismo que hace el sistema anterior: el pedido nace apuntando a un **lote**
concreto, no a un ítem. La línea de egreso lleva el lote desde que se crea.

**Objeción registrada, y por qué no bloquea.** En la base vieja este modelo
produjo saldos negativos, pero la causa **no fue quién elige**: fue que su
selector ofrece lotes agotados (`Saldo:0.00`) y que el saldo se tocaba fuera de
transacción. Acá esos dos defectos no se copian:

- El selector **solo ofrece lotes con disponible > 0** (disponible = saldo −
  reservado), calculado en el servidor.
- La reserva se hace **dentro de la transacción** que graba el pedido, tomando
  el lote con bloqueo de fila. Dos solicitantes no pueden reservar el mismo saldo.

---

### 6. El pedido reserva el material desde que se registra (2026-07-29)

Igual que el sistema anterior, pero explícito en vez de accidental (allá el saldo
restaba todas las líneas sin mirar el estado, y liberar un rechazo obligaba a
poner las cantidades en cero).

**Cómo se representa — propuesta técnica, no requiere al encargado:** la reserva
NO es una columna. `disponible = saldoCantidad − reservado`, donde `reservado` se
**deriva** de las líneas de egreso cuyo pedido está en un estado pendiente. Es la
lección directa de `SALDOCANTIDAD`, el campo de saldo del sistema anterior, que
está desincronizado en el **59%** de los lotes por mantenerse a mano.

Consecuencia buena: **el rechazo libera solo**. Al cambiar de estado el pedido,
sus líneas dejan de contar como reserva; no hay que poner nada en cero ni correr
un proceso de limpieza.

---

### 7. Rechazo, cancelación, saltos y ausencias (2026-07-29)

- **Un rechazo, en cualquier nivel, vuelve al solicitante.** Nunca al nivel
  anterior. El solicitante corrige y reenvía desde el principio. (Confirma lo que
  ya estaba asumido; en el sistema anterior el pedido no volvía a ningún lado,
  quedaba marcado.)
- **El solicitante NO puede anular su propio pedido** una vez enviado: sigue el
  circuito.
- **Ningún pedido saltea niveles**, ni por monto ni por cantidad.
- **Ausencias: los pedidos esperan** a que la persona vuelva. **No hay
  suplencia** — el aprobador es siempre el jefe de su unidad, y el responsable,
  el de su almacén.

---

### 8. Justificación en vez de actividad, y sin categoría (2026-07-29)

- El campo `actividad` del sistema anterior pasa a llamarse **`justificacion`**:
  texto libre, para qué se pide el material.
- **La categoría se elimina.** No va el catálogo de 9 valores que el impreso
  viejo llamaba «Programa» (Semillas, Fortalecimiento del SNIAF, Transferencia de
  Tecnología…). No hace falta CRUD ni seed, y ese recuadro desaparece del
  documento impreso.

## Abierto

Ya nada de esto bloquea el schema; son reglas del service o del impreso.

| Qué | Estado |
|---|---|
| **Falta de stock físico al entregar** | Quedó sin responder, pero las otras respuestas casi lo resuelven: si el pedido reserva desde que se registra, el sistema ya garantiza el saldo. Lo único que queda es el faltante **físico** (lo que hay en el estante no coincide), y para eso el responsable ya puede ajustar la cantidad. **Propuesta: entrega menos y el pedido queda entregado con la cantidad ajustada.** Confirmar. |
| **Anulación de un egreso ya entregado** | Quién autoriza, si hay plazo límite y si el motivo es obligatorio. Sin responder. |
| **`justificacion`: ¿obligatoria? ¿largo?** | En el sistema anterior era opcional de hecho (se llena en el 63,9%, mediana 48 caracteres, máximo 207). **Propuesta: obligatoria, 300 caracteres.** |
| **Plazos por nivel** | No se pueden estimar con datos del sistema anterior: sus fechas de firma nunca se escribieron (constantes `2000-01-01`/`2000-01-02` en 24.664 filas). |
