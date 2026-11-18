# Pruebas manuales en el navegador — revisión del 2026-11-18

Lo que sigue **no se pudo comprobar con las pruebas automáticas**, porque esas fueron por la API y
no abren el navegador. Cada caso dice qué hacer y qué tiene que pasar. Marcá `[x]` lo que salga
bien; si algo no coincide, anotá qué viste.

**Antes de empezar**

- Hacelo en local (`pnpm dev` en backend y frontend) o en la VM después de actualizarla.
- Recargá con **Ctrl+F5**.
- Necesitás un almacén con al menos dos unidades, un proveedor, dos ítems, y un usuario de cada
  rol: super_admin, responsable de almacén, solicitador, aprobador (de la misma unidad que el
  solicitador) y observador de ese almacén.

Los casos están ordenados por importancia: los de la sección 1 a 3 son los que más dudas dejan.

---

## 1. Campos de cantidad y precio (lo más importante)

En **Ingresos → Nuevo ingreso**, agregá una línea y probá en *Cantidad* y en *Precio unit.*
Escribí tecla por tecla, no pegando, salvo donde dice «pegar».

| # | En el campo | Escribís | Tiene que quedar al salir del campo |
|---|---|---|---|
| 1.1 | Cantidad | `12` | `12,00` |
| 1.2 | Cantidad | `12,5` | `12,50` |
| 1.3 | Cantidad | `12.5` (con punto, como el teclado numérico) | `12,50` |
| 1.4 | Cantidad | `10.000,00` | `10000,00` (diez mil, **no** `10,00`) |
| 1.5 | Cantidad | `1.234.567,89` | `1234567,89` |
| 1.6 | Cantidad | `2.000` | `2,000` y el error **«Máximo 2 decimales»** al guardar |
| 1.7 | Precio | `1.234,50` | `1234,50` |
| 1.8 | Precio | `0,00125` | `0,00125` (no se recorta ni se rellena) |
| 1.9 | Precio | `25` | `25,00` |
| 1.10 | Cantidad | pegar `1.234,56` | `1234,56` |
| 1.11 | Cantidad | `abc` o `-5` | no deja escribir letras ni el signo menos |

- [ ] 1.1 a 1.11 dan lo esperado.
- [ ] El **Subtotal** de la línea y el **Total** coinciden con cantidad × precio en cada caso.
- [ ] Registrá el ingreso con `10.000,00` de cantidad y `3,75` de precio: en el listado el total
      es `37.500,00`.
- [ ] Repetí 1.2, 1.4 y 1.6 en **Egresos → Nuevo pedido** (campo Cantidad).
- [ ] Repetí 1.2 y 1.4 en **Traspasos → Nuevo traspaso** (columna de cantidad a traspasar).

## 2. Fechas del ingreso

- [ ] **2.1** Registrá un ingreso con *Fecha de remisión* = un día concreto (ej. 10/11) y *Fecha
      del informe* = otro (ej. 11/11). En el listado y al reabrirlo se ven **esos mismos días**,
      no el anterior.
- [ ] **2.2** Abrí «Ver PDF» de ese ingreso: la nota muestra las mismas dos fechas.
- [ ] **2.3** Como responsable, abrí el ingreso, cambiá solo el Nº de factura y guardá. Hacelo
      **tres veces seguidas**. Las fechas de remisión e informe no se mueven.
- [ ] **2.4** Como **super_admin**, abrí el mismo ingreso, cambiá solo el Nº de factura y guardá
      tres veces. La *Fecha de ingreso* sigue siendo la del día en que se registró, y en
      **Kardex** la entrada de ese ítem conserva su fecha.
- [ ] **2.5** Como super_admin, cambiá la *Fecha de ingreso* a un día anterior del mismo mes y
      guardá. Queda **exactamente ese día** (no el anterior), y el kardex muestra la entrada en
      ese día.
- [ ] **2.6** Con un ingreso del que ya se entregó material: intentá poner una fecha de ingreso
      posterior al día de la entrega. Tiene que rechazarlo con un mensaje que nombra la fecha de
      la salida.

## 3. Entrega de pedidos (columna «A entregar»)

Con un pedido aprobado, entrando como responsable de almacén:

- [ ] **3.1** La columna viene cargada con lo pedido, con dos decimales (`5,00`).
- [ ] **3.2** Borrá el contenido de una fila: aparece en rojo «Escribí la cantidad (0 si no se
      entrega)» y «Confirmar entrega» queda deshabilitado.
- [ ] **3.3** Escribí `1,234`: aparece «Máximo 2 decimales».
- [ ] **3.4** Escribí más de lo pedido: «No puede superar lo pedido (N)».
- [ ] **3.5** Poné **todas** las filas en `0`: el botón queda deshabilitado; al pasar el mouse
      explica que hay que rechazar el pedido.
- [ ] **3.6** En un pedido de dos líneas, poné una en `0` y la otra con cantidad: sí deja
      confirmar, y el diálogo nombra la línea que sale con menos.
- [ ] **3.7** Confirmá una entrega menor a lo pedido: el pedido queda «Entregado», el stock baja
      solo lo entregado y el kardex muestra la salida.

## 4. Disponible con decimales

- [ ] **4.1** Registrá un ingreso de un ítem con cantidad `0,30`. Como solicitador, creá un pedido
      de `0,10` de ese lote y dejalo sin enviar. Creá **otro** pedido del mismo lote: el
      disponible se ve `0,2` (no `0,19999…`) y deja pedir `0,20`.
- [ ] **4.2** En **Traspasos → Nuevo traspaso**, con ese almacén de origen, «Elegir todo el
      almacén»: ninguna fila aparece con error ni con una cifra de muchos decimales.

## 5. Reportes PDF y Excel (fechas)

Lo ideal es hacerlo con algo registrado **después de las 20:00** (o cambiando la hora de la PC a
las 21:00 antes de registrar un ingreso de prueba).

- [ ] **5.1** *Ingresos → Reporte → PDF*: la fecha de cada fila es la misma que muestra el listado
      en pantalla.
- [ ] **5.2** *Ingresos → Reporte → Excel*: igual, y el total del Excel coincide con el del PDF.
- [ ] **5.3** *Egresos → Reporte* (PDF y Excel): las fechas coinciden con la pantalla.
- [ ] **5.4** *Kardex → Reporte* (PDF y Excel): las fechas de los movimientos coinciden con la
      pantalla de kardex.
- [ ] **5.5** El nombre del archivo descargado lleva la fecha de hoy, no la de mañana.
- [ ] **5.6** *Stock → Reportes* (los dos, PDF y Excel): se generan y los totales coinciden entre
      PDF y Excel.

## 6. La pantalla se actualiza sola

- [ ] **6.1** Abrí **Stock**. Sin recargar, andá a Ingresos, registrá uno y volvé a Stock
      enseguida: el lote nuevo ya aparece.
- [ ] **6.2** Anulá ese ingreso y volvé a Stock: el lote ya no figura.
- [ ] **6.3** Con el **Kardex** de un ítem abierto, registrá un ingreso de ese ítem y volvé: la
      entrada nueva está.
- [ ] **6.4** En **Ítems**, un ítem recién usado en un ingreso ya no deja cambiar la partida ni la
      unidad de medida (el diálogo lo explica).

## 7. Observador de almacén

Entrando con el usuario observador:

- [ ] **7.1** Abrí un ingreso: todos los campos están deshabilitados y **no** aparecen «Guardar
      cambios» ni «Anular». «Ver PDF» sí.
- [ ] **7.2** En ese ingreso se ven el proveedor, la fuente y el responsable (no quedan en blanco).
- [ ] **7.3** En **Stock** y en **Kardex**, el filtro «Fuente» trae la lista de fuentes y filtra.
- [ ] **7.4** Con F12 → pestaña Red abierta, recorré Ingresos, Stock y Kardex: no hay respuestas
      en rojo (403).

Con el **solicitador** y el **aprobador**:

- [ ] **7.5** En **Stock** el filtro «Fuente» funciona y no hay respuestas 403 en la pestaña Red.

## 8. Editar un pedido que falla al guardar

- [ ] **8.1** Como solicitador, abrí un pedido sin enviar, cambiá la justificación y subí la
      cantidad a más del disponible. Guardá: sale el error de disponible y **lo que escribiste
      sigue en el formulario** (no vuelve a los valores guardados).

## 9. Login

- [ ] **9.1** Escribí mal la contraseña de un usuario de prueba 10 veces: cada intento dice
      «Usuario o contraseña incorrectos». El intento 11 dice «Demasiados intentos fallidos. Probá
      de nuevo en N minuto(s)».
- [ ] **9.2** Mientras dura el bloqueo, otro usuario entra normalmente.
- [ ] **9.3** Reiniciá el backend (o esperá 15 minutos): el usuario bloqueado vuelve a entrar.
- [ ] **9.4** El login se ve bien: fondo verde azulado e íconos dentro de los dos campos, en modo
      claro y en oscuro.

## 10. Sesión con la red cortada

- [ ] **10.1** Con la sesión abierta, detené el backend y recargá la página (F5). **No** te manda
      al login: se ve el sistema con errores de carga. Al levantar el backend y recargar, todo
      vuelve sin pedir usuario.
- [ ] **10.2** Cerrá sesión de verdad y volvé a entrar: funciona como siempre.
- [ ] **10.3** La sesión sigue cerrándose a los 30 minutos sin actividad (para no esperar: en la
      consola, `localStorage.setItem("almacenes.ultimaActividad", Date.now() - 29 * 60 * 1000)`).

## 11. Unidades

- [ ] **11.1** Creá una unidad raíz con un grupo nuevo (ej. OTROS) y una hija. Editá la hija y
      movela bajo una unidad del grupo MOF: la hija aparece ahora en la tabla del grupo MOF.
- [ ] **11.2** Desactivá una unidad con hijas usando el **checkbox «Activo»** del formulario: las
      hijas también quedan inactivas.
- [ ] **11.3** Intentá reactivar una hija con el padre todavía inactivo: lo rechaza y pide
      reactivar primero la unidad superior.

## 12. Usuarios

- [ ] **12.1** Editá el nombre de un usuario y guardá: funciona (también si su unidad está dada
      de baja).
- [ ] **12.2** Con un almacén dado de baja, intentá reactivar a un usuario que era de ese almacén:
      lo rechaza diciendo que el almacén está inactivo.
- [ ] **12.3** Crear un usuario, copiar sus datos de acceso y restablecer su contraseña siguen
      funcionando.

## 13. Catálogos (campos en blanco)

- [ ] **13.1** En **Proveedores**, editá uno y borrá el NIT: guarda y el NIT queda vacío.
- [ ] **13.2** Intentá crear un proveedor con el nombre hecho solo de espacios: no lo acepta.
- [ ] **13.3** Intentá crear un pedido con la justificación hecha solo de espacios: no lo acepta.
- [ ] **13.4** Al rechazar o anular, un motivo hecho solo de espacios no se acepta.

## 14. Repaso rápido del circuito (ya probado por la API, conviene verlo una vez)

- [ ] **14.1** Pedido completo: crear → enviar → aprobar → entregar. El número se asigna al
      enviar y el PDF de la solicitud se abre al estar entregado.
- [ ] **14.2** Rechazar un pedido: vuelve al solicitador como «Devuelto» con el motivo; al
      corregirlo y reenviarlo conserva el número.
- [ ] **14.3** Anular un pedido entregado: el stock vuelve y el kardex muestra la reversión.
- [ ] **14.4** Traspaso entre dos almacenes: baja en el origen, aparece en el destino con el mismo
      precio, y la nota de traspaso se abre en PDF.
- [ ] **14.5** **Administración → Cierre de gestión**: la pantalla carga y muestra el estado de
      cada almacén. (No cierres una gestión en la base real solo para probar: no tiene vuelta
      atrás.)

## 15. En la VM, después de actualizar

- [ ] **15.1** `docker compose -f docker-compose.prod.yml logs --since 5m backend` no muestra
      errores al arrancar. Si aparece un aviso sobre `JWT_ACCESS_SECRET` o `JWT_REFRESH_SECRET`,
      hay que generar secretos nuevos en el `.env`.
- [ ] **15.2** Se puede entrar, subir la foto de un ítem y verla (prueba el proxy y los límites).
- [ ] **15.3** `docker compose -f docker-compose.prod.yml run --rm respaldos ahora` termina con la
      línea «listo: … base, … fotos» y deja los dos archivos en `respaldos/`.

---

**Si algo falla**, lo más útil para corregirlo es: el número del caso, qué escribiste o hiciste, lo
que apareció en pantalla y, si hay, el error de la consola del navegador (F12).
