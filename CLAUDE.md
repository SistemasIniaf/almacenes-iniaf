# Proyecto: Sistema de Almacenes (multi-almacén) — Institución Pública

## Descripción general

Sistema de gestión de almacenes/inventario para una institución pública con **9+ almacenes independientes**. Cada almacén tiene su propio stock y correlativos, pero comparte un catálogo único de ítems. El sistema NO incluye el módulo de activos fijos (fuera de alcance).

Referencia de negocio: se analizó el sistema open-source NSIAF (ADSIB/AGETIC, Bolivia) como referencia de lógica de negocio de almacenes — pero NSIAF es **mono-almacén** y de **un solo nivel de aprobación**, mientras que este sistema es multi-almacén y tiene una cadena de aprobación de 3 niveles. No se reutiliza código de NSIAF, solo se tomó como referencia conceptual (ver `docs/comparativo-nsiaf.md`).

## Stack tecnológico

- **Backend**: Node.js + TypeScript + NestJS
- **ORM / DB**: Prisma + PostgreSQL
- **Frontend**: React + TypeScript + Vite (NO Next.js — no hay necesidad de SSR, todo vive detrás de login)
- **UI**: shadcn/ui + react-hook-form + Zod (ver sección "Stack de UI del frontend" más abajo para convenciones de componentes)
- **Data fetching frontend**: TanStack Query (React Query)
- **Auth**: JWT (access + refresh token), bcrypt para passwords
- **Contenedores**: Docker solo para Postgres en desarrollo (`docker-compose.yml`). Backend y frontend corren nativos en desarrollo (hot-reload). Dockerizar todo recién para despliegue (`docker-compose.prod.yml`).
- **Despliegue**: on-premise, servidor propio de la institución.

## Estructura del repo (monorepo simple, sin Nx/Turborepo)

```
almacenes-institucion/
├── backend/     (NestJS)
├── frontend/    (Vite + React)
├── docker-compose.yml   (solo Postgres en dev)
├── docs/        (documentos de diseño y decisiones)
└── CLAUDE.md    (este archivo)
```

## Entidades principales

- **Unidad**: nombre, sigla, activo, `grupo`, jerárquica (`padre_id`). Área administrativa. Es un **CATÁLOGO COMPARTIDO**: NO pertenece a un almacén. Cada Almacén **selecciona** qué unidades muestra vía la tabla puente **`AlmacenUnidad`** (muchos-a-muchos) — así los rubros departamentales se crean una sola vez y se reusan. El **`grupo`** (MOF, OTROS…, en MAYÚSCULAS) lo elige la unidad RAÍZ y **los hijos lo heredan** (todo el subárbol comparte grupo); sirve para mostrar el catálogo en tablas por grupo y para agrupar el selector del almacén. El organigrama real del INIAF (54 unidades, grupo MOF) se siembra desde `prisma/data/unidades-iniaf.ts` (idempotente por sigla).
- **AlmacenUnidad**: puente Almacén ↔ Unidad. Define qué unidades ofrece el selector de "unidad solicitante" del Ingreso de ese almacén.
- **FuenteFinanciamiento**: nombre (único), `codigo` (opcional), activo. Recursos Específicos, Banco Mundial, COSUDE, programas TGN… Una sola fuente por Ingreso (va en la cabecera). Baja lógica: queda referenciada por lotes históricos.
- **Almacen**: nombre, activo. Cada institución tiene 9+.
- **Usuario**: username (no email), password (hash bcrypt), nombre, `cargo`, activo, `unidad_id`, `almacen_id`, `rol`. `almacen_id` es INDEPENDIENTE de `unidad_id` (no están ligados). **`nombre` y `cargo` se guardan SIEMPRE en MAYÚSCULAS** (así figuran en los documentos oficiales de la institución): el `InputField` lo fuerza al escribir —hoy es el comportamiento por defecto de TODO el sistema, ver "Mayúsculas automáticas"— y el service lo normaliza igual, porque **la API es la fuente de verdad** y el front no es una barrera. `cargo` es **obligatorio salvo para `super_admin`/`admin`** (los dos roles que no ocupan un puesto en el organigrama); por eso la columna sigue nullable en la BD y la regla vive en el service (`ROLES_SIN_CARGO`).
- **Roles** (6): `super_admin`, `admin`, `solicitador`, `aprobador`, `responsable_almacen`, `observador_almacen`.
  - `super_admin`: sin unidad ni almacén, sin cargo obligatorio. Acceso total.
  - `admin`: sin unidad ni almacén, sin cargo obligatorio. Igual que super_admin salvo que **NO gestiona los tres catálogos estructurales: Unidades, Almacenes ni Partidas** (cambio del 2026-08-03: antes sí gestionaba Almacenes). Los **lee** —los necesita para poblar los selectores al crear usuarios— pero no los crea, edita ni desactiva. La regla vive en los `@Roles` de cada controlador (escritura `super_admin`, lectura `super_admin` + `admin`) y la espeja `PERMISOS` en el frontend.
  - `solicitador`: unidad y almacén requeridos (fijo, destino de sus egresos). Varios por unidad.
  - `aprobador`: unidad Y almacén requeridos (igual que `solicitador`). Único ACTIVO por unidad; el almacén NO es único (varios aprobadores pueden compartir almacén).
  - `responsable_almacen`: unidad Y almacén requeridos (la unidad se agregó el 2026-07-21; antes no la llevaba). Único ACTIVO por almacén.
  - `observador_almacen`: sin almacén fijo — usa tabla intermedia `UsuarioAlmacenObservado` (relación muchos-a-muchos, selecciona qué almacenes puede ver, para auditoría).
  - **`central` fue ELIMINADO** el 2026-07-21 (confirmado con el encargado de almacenes): el circuito de egresos pasó de 3 a 2 niveles de aprobación. Ver la migración `20260721180000_quita_rol_central`.
- **Partida** (reemplaza al concepto anterior de "Material"): catálogo oficial del Clasificador por Objeto del Gasto (Ministerio de Economía y Finanzas Públicas, Bolivia, publicado por gestión/año fiscal). NO se crea libremente en el sistema — se importa/semilla desde el documento oficial. Es **jerárquica** (auto-referenciada, hasta 5 niveles: Grupo → Subgrupo → Partida → Subpartida → Sub-subpartida), porque el clasificador real tiene profundidad variable por rama. Campos: codigo (string, ej. "39700"), denominacion, nivel (1-5, calculado por cantidad de ceros finales del código), padreId (auto-referencia), `seleccionable` (boolean — SOLO true en los nodos hoja, es decir códigos sin hijos; son los únicos que se pueden asignar a un Ítem), activo, `ultimoCorrelativo` (contador para generar códigos de Ítem, solo relevante si `seleccionable=true`). Un solo catálogo vigente, SIN versionado histórico por gestión (se actualiza in-place si el Ministerio publica cambios; poco frecuente). Alcance del seed: **los 9 grupos completos** del Clasificador por Objeto del Gasto (`10000` a `90000`, ~505 partidas), extraídos del PDF oficial (gestión 2026). Los grupos `20000` (Servicios No Personales) y `30000` (Materiales y Suministros) son los relevantes para el almacén y están curados a mano; el resto se extrajo del PDF y la institución los deja desactivados desde la UI si no los usa (el "activo efectivo" inhabilita toda la rama). El seed valida grupos `1`-`9` (ver `GRUPOS_PERMITIDOS` en `prisma/seed.ts`).
- **Item**: el ítem real de almacén (catálogo compartido entre todos los almacenes). Campos: codigo (AUTOGENERADO al crear: `{partida.codigo}-{correlativo interno padStart(6)}`, ej. "39700-000001", incrementado transaccionalmente sobre `Partida.ultimoCorrelativo`), descripcion, unidadMedida, `imagenUrl` (String?, nullable), activo, `partida_id`.
- ~~**StockAlmacen**~~: **ELIMINADO del diseño**. El stock NO es un saldo agregado: se lleva **por LOTE** (ver `IngresoDetalle`) y separado por fuente de financiamiento.
- **Proveedor**: nombre (requerido, NO único — la razón social se escribe de formas distintas), `nit` (opcional pero `@unique`; Postgres admite varios NULL en un índice único, así que conviven proveedores sin NIT), telefono, `contacto` (nombre de la persona de contacto), direccion, activo. Baja lógica siempre: será referenciado por Ingreso y no se puede borrar sin romper el Kardex. Escritura para `super_admin` y `admin`; lectura además para `responsable_almacen` (necesita el selector de proveedor al registrar un Ingreso).
- **Ingreso** (YA IMPLEMENTADO): cabecera del ingreso de material. `estado` (`CONFIRMADO`/`ANULADO` — **ya NO hay `BORRADOR`**; el encargado lo quitó el 2026-07-27: se crea definitivo en un solo paso, ver migración `20260727120000_ingresos_sin_borrador`), `numero` + `gestion` (nullable en la BD pero el service los estampa SIEMPRE al crear), `almacen_id`, **`fechaIngreso`** (ver abajo), respaldos (fechaRemision, notaRemision, procesoC31, certificacion, informeConformidad + **fechaInformeConformidad**, numeroFactura, observacion), `proveedor_id`, `fuente_financiamiento_id`, `responsable_conformidad_id` (→ Usuario rol `solicitador`), `unidad_solicitante_id`, auditoría (`registrado_por_id`) y anulación (`anulado_por_id`, `anulado_en`, `motivo_anulacion`). Los respaldos siguen nullable en la BD pero son **obligatorios**: la regla vive en el service (los exige al crear, como el `cargo` del usuario). `@@unique([almacenId, gestion, numero])`. Registrado por `responsable_almacen` de ESE almacén, **sin aprobación**.
  - **Las TRES fechas del ingreso** (no confundirlas — cambio del 2026-07-29, migración `20260729190000_ingreso_fecha_propia`): **`fechaIngreso`** es la de EFECTO CONTABLE: de ella salen la gestión (y con ella el correlativo), la fecha del movimiento de Kardex y el orden en que se consumen los lotes. **La estampa el backend con el momento del registro: nadie la tipea.** · **`fechaRemision`** es la del documento del proveedor: se sigue pidiendo e imprimiendo, pero **ya NO gobierna nada**. Antes definía la gestión, así que un error de tipeo en el año mandaba el ingreso a otra gestión y descolocaba el libro. · **`createdAt`** es auditoría pura y nunca se corrige.
  - **Solo `super_admin` puede corregir `fechaIngreso`** (`ForbiddenException` para el resto; el caso previsto es el cierre de gestión: material que entró el 28/12 y se registró el 2/1). La corrección va en UNA transacción porque arrastra tres cosas: mueve la fecha de los movimientos de Kardex, y **si cae en otra gestión re-estampa el correlativo** (el número se había asignado en la secuencia de la gestión anterior y ahí no vale). No se admite fecha futura.
- **IngresoDetalle** (= el **LOTE**): `ingreso_id`, `item_id`, `cantidad(12,2)`, `precioUnitario(12,5)`, `saldoCantidad(12,2)`, `observacion` (String?, nota libre por línea, ej. "COLOR NEGRO"; se imprime junto a la descripción del ítem entre paréntesis en el reporte: "BOTAS DE AGUA (COLOR NEGRO)" — como el sistema anterior). También `imagenUrl` (String?, foto de ESTE lote — ver "Foto por lote" más abajo). El almacén y la fuente del lote los aporta el Ingreso. **El stock de un ítem = suma de los saldos de sus lotes de ingresos CONFIRMADOS.** El saldo se modifica SIEMPRE dentro de la transacción que lo mueve.
- **MovimientoKardex**: libro por ítem + almacén. `tipo` (`ENTRADA`/`SALIDA`/`REVERSION`), cantidad, precioUnitario, `ingreso_id`, `ingreso_detalle_id`, fecha, motivo. Nunca se borra: es la fuente para recalcular saldos. Hoy solo ENTRADA (confirmar) y REVERSION (anular); SALIDA llega con Egresos.
- **Egreso**: `almacen_id` (heredado del solicitante), `unidad_id` (heredado del solicitante), correlativo POR ALMACÉN, estado, solicitante.
- **EgresoDetalle**: apunta al **LOTE** (`ingreso_detalle_id`, no al ítem), `cantidadSolicitada` y `cantidadEntregada` (null hasta la entrega; la ajusta SOLO el `responsable_almacen`). **NO lleva observación por línea**, a diferencia de `IngresoDetalle`: lo que hay que aclarar de un pedido va en la `justificacion` de la cabecera, que es obligatoria. La columna existió y se quitó el 2026-07-30 (migración `20260730120000_egreso_detalle_sin_observacion`) por decisión del encargado — no volver a agregarla.
- **EgresoHistorial**: registro de cada decisión (nivel, usuario, decisión, motivo, fecha) — trazabilidad completa, nunca se borra nada.
- **Transaccion (Kardex)**: movimiento por ítem + almacén (entrada por Ingreso, salida por Egreso aprobado, reversión por anulación).

Todas las entidades incluyen `createdAt DateTime @default(now())` y `updatedAt DateTime @updatedAt`.

## Reglas de unicidad de roles (Opción B: índices únicos parciales en PostgreSQL)

Prisma no soporta índices parciales (`WHERE`) en su DSL — se agregan a mano editando el SQL de la migración generada por `prisma migrate dev`, antes de aplicarla:

```sql
CREATE UNIQUE INDEX uq_aprobador_por_unidad
ON usuarios (unidad_id)
WHERE rol = 'aprobador' AND activo = true;

CREATE UNIQUE INDEX uq_responsable_por_almacen
ON usuarios (almacen_id)
WHERE rol = 'responsable_almacen' AND activo = true;
```

**OJO al tocar el enum `Rol`**: el predicado de estos índices castea al tipo (`rol = 'aprobador'::"Rol"`), así que cualquier migración que recree el enum tiene que **dropearlos antes y recrearlos después**; si no, el `ALTER COLUMN ... TYPE` falla con `operator does not exist: "Rol_new" = "Rol"`. Está resuelto así en `20260721180000_quita_rol_central`.

Complementar SIEMPRE con validación en el service (mensaje de error claro antes de que falle el índice: ej. "La unidad ya tiene un aprobador asignado"). `observador_almacen` NO lleva índice único — puede repetirse (varios observadores por almacén, varios almacenes por observador) vía la tabla `UsuarioAlmacenObservado`.

## Regla de negocio crítica: el almacén de un Egreso

El almacén destino de un Egreso es **siempre el `almacen_id` del usuario Solicitador** (fijo, no se elige manualmente al crear el egreso).

## Máquina de estados del Egreso

```
BORRADOR
   │ enviar
   ▼
PENDIENTE_APROBADOR   (aprobador = jefe de la unidad del solicitante)
   │ aprueba — NO toca cantidades ─────► PENDIENTE_RESPONSABLE_ALMACEN
   │ rechaza ──────────────────────────► BORRADOR
   ▼
PENDIENTE_RESPONSABLE_ALMACEN   (responsable del almacén del solicitante — último nivel)
   │ aprueba y entrega (AJUSTA la cantidad final)
   │    → descuenta el saldo de los lotes pedidos
   │    → genera movimiento de SALIDA en Kardex
   │ rechaza ──────────────────────────► BORRADOR
   ▼
APROBADO (entregado)
```

**Quién ajusta cantidades** (confirmado con el encargado el 2026-07-29): SOLO el `responsable_almacen` al entregar, y el `solicitador` cuando corrige un pedido rechazado. El `aprobador` **solo aprueba o rechaza**.

**Regla clave**: un rechazo en CUALQUIER nivel (aprobador o responsable_almacen) regresa el Egreso al estado `BORRADOR` (nivel 1, el solicitador), nunca al nivel anterior. El solicitador corrige y reenvía desde el inicio.

**Sin cancelación ni saltos ni suplencia**: enviado el pedido, el solicitador no puede anularlo; ningún egreso saltea niveles; y si el aprobador o el responsable están ausentes, **los pedidos esperan** (no hay reemplazo).

**Cambio 2026-07-21**: el circuito era de 3 niveles y terminaba en un `central` por almacén. Se eliminó ese rol: ahora el `responsable_almacen` es quien ejecuta la salida. **Queda pendiente redefinir el control de stock** (ver sección siguiente): la reserva progresiva existía porque había dos pasos entre la aprobación y la salida física, y ahora ese hueco desapareció.

## Control de stock — REDEFINIDO el 2026-07-21 (por LOTE)

> ⚠️ El modelo que se describía antes acá (`StockAlmacen` con `stock_fisico` /
> `stock_reservado`, un saldo agregado por ítem y almacén) **quedó sin efecto**.
> Se relevó el sistema anterior del INIAF y se confirmó con el encargado otro
> modelo. Detalle completo en `docs/decisiones-ingresos.md` y
> `docs/analisis-sistema-anterior.md`.

**El stock se lleva por LOTE**: cada línea de ingreso conserva su cantidad, su
precio unitario y su saldo. El stock de un ítem no es un número, es la suma de
los saldos de sus lotes. Cada salida se descuenta de lotes concretos y se
valoriza al precio de ese lote (así el kardex da el costo real, no un promedio).

**Y se separa por FUENTE DE FINANCIAMIENTO** (Recursos Específicos, Banco
Mundial, COSUDE, DANIDA, programas TGN…): el mismo ítem comprado con dos fuentes
son dos saldos distintos, porque cada financiador exige rendición de su plata.
Es un CRUD propio; una sola fuente por ingreso (va en la cabecera).

Por qué así: es como opera el INIAF hoy. Datos verificados sobre 11 gestiones —
el 41% de los ítems se compró a más de un precio en la misma gestión y el 35%
con más de una fuente.

Aprendizaje del sistema anterior: su campo de saldo por lote (`SALDOCANTIDAD`)
está desincronizado en el **59%** de los lotes y tiene saldos negativos, porque
se actualizaba fuera de transacción. Acá el saldo del lote se modifica **dentro
de la transacción** que lo mueve, y toda la historia queda en la tabla de
movimientos para poder recalcularlo.

**Resuelto el 2026-07-29** (respuestas del encargado, ver
`docs/decisiones-egresos.md`):

- **El lote y la fuente los elige el SOLICITANTE**: la línea de egreso apunta a
  un lote concreto desde que se crea, no a un ítem. (Se descartó la propuesta de
  que el almacén resolviera el lote al entregar.)
- **El pedido RESERVA desde que se registra.** La reserva **no es una columna**:
  `disponible = saldoCantidad − reservado`, donde `reservado` se **deriva** de
  las líneas de egreso en estados pendientes. Es la lección de `SALDOCANTIDAD`
  del sistema anterior, desincronizado en el 59% de los lotes por mantenerse a
  mano. Efecto lateral bueno: **el rechazo libera solo**, sin proceso de limpieza.
- El selector de lotes **solo ofrece los que tienen disponible > 0**, y la
  reserva se toma **dentro de la transacción** que graba el pedido (bloqueo de
  fila sobre el lote). Ahí estaban las dos causas reales de los saldos negativos
  del sistema anterior — no en quién elige el lote.

## Anulación / reversión

Un Egreso `APROBADO` se puede anular:
- Marca lógica `ANULADO` (nunca se borra el registro).
- Revierte stock: `stock_fisico += cantidad_final`.
- Genera movimiento de reversión en el Kardex.
- Registra en `EgresoHistorial` quién anuló, cuándo y el motivo.

## Autenticación — sin registro público

**No existe pantalla de registro (`/register`).** Los usuarios se crean exclusivamente desde el módulo `usuarios` (por `super_admin`/`admin`), con username/password asignados ahí. El frontend solo tiene pantalla de **login** — no hay flujo de auto-registro, recuperación de cuenta por "crear cuenta nueva", ni endpoint público de `POST /auth/register`. La creación de usuarios es siempre una acción administrativa autenticada (`POST /usuarios`, protegido por rol), nunca un endpoint público.

## Imágenes (subida de archivos)

Hay **DOS** fotos y responden preguntas distintas — no se pisan por accidente, se
pisan a propósito (ver "Foto por lote"):

| Foto | Pregunta que responde | Dónde vive |
|---|---|---|
| **Ítem** (catálogo) | ¿Qué TIPO de cosa es esto? | `Item.imagenUrl` → `uploads/items/` |
| **Lote** (stock) | ¿Qué hay exactamente en ESTA compra? | `IngresoDetalle.imagenUrl` → `uploads/lotes/` |

Cada `Item` puede tener **UNA imagen referencial** (foto de catálogo). Decisiones tomadas (confirmadas con el usuario):

- **Cardinalidad**: 1 imagen por ítem (campo `imagenUrl String?` en `Item`, NO tabla `ItemImagen`). Si en el futuro se necesitan varias, migrar a tabla 1-a-N es barato; no se sobre-construye ahora.
- **Almacenamiento**: **filesystem**, NO en la DB. El binario vive en `backend/uploads/items/` (en `.gitignore`); la DB guarda solo la ruta pública relativa (ej. `/uploads/items/3-8eeae5d8.webp`). El nombre lleva un sufijo aleatorio (`{itemId}-{uuid8}.webp`) para que la URL no sea adivinable.
- **Procesamiento**: la imagen subida NUNCA toca disco cruda. Se re-procesa con **`sharp`** (redimensiona a máx. `1024px` lado mayor sin ampliar + convierte a **WebP** calidad 80) y recién el resultado se escribe. Límites: máx. 5 MB de entrada, MIME permitidos `image/jpeg|png|webp`.
- **Servido**: **estáticas públicas** bajo `/uploads` vía `app.useStaticAssets` en `main.ts`. Quedan **FUERA** del prefijo global de la API y del `JwtAuthGuard` global — decisión deliberada para poder usarlas con `<img src>` directo. Trade-off aceptado: son adivinables solo por fuerza bruta (mitigado por el sufijo aleatorio); son fotos referenciales no sensibles.
- **Endpoints** (solo `super_admin`/`admin`): `POST /items/:id/imagen` (campo multipart `imagen`; reemplaza y borra la anterior del disco) y `DELETE /items/:id/imagen` (limpia archivo + pone `imagenUrl=null`). El CRUD normal (`PATCH`) NO toca la imagen.
- **Config central**: constantes y opciones de Multer en `src/common/uploads/uploads.config.ts` (compartidas entre los services de items e ingresos y `main.ts`). El **pipeline** (sharp → WebP, escritura y borrado best-effort) vive en `src/common/uploads/imagenes.ts` y lo comparten los dos: si el tamaño o la calidad se tocaran en un solo lado, la foto del ítem y la del lote que la pisa saldrían con distinto peso y nitidez, una al lado de la otra.
- **Frontend**: `ImageField` (subida con preview) YA construido y cableado en `ItemFormDialog` y en `IngresoLineas` — ver las notas de `items` más abajo (no es un campo de react-hook-form como el resto de los `*Field`).
- **Pendiente despliegue**: en `docker-compose.prod.yml`, montar `uploads/` como **volumen** para que las imágenes sobrevivan a reconstrucciones del contenedor. Cubre las dos subcarpetas (`items/` y `lotes/`). Ojo con el tamaño: las de ítem son una por ítem y se sacan una sola vez; las de lote son **una por línea de cada ingreso y no dejan de acumularse** (un lote agotado hace tres gestiones conserva su archivo). Por eso van en subcarpetas separadas: se pueden medir —y algún día limpiar— sin tocar el catálogo.

### Foto por lote (`IngresoDetalle.imagenUrl`) — 2026-08-07

**Opcional, con fallback**: donde se muestra el material vale `lote.imagenUrl ?? item.imagenUrl`. No hay nada que migrar y un lote sin foto propia sigue mostrando la del catálogo — que es lo correcto para la mayoría de los ítems (papel, bolígrafos), donde todos los lotes se ven igual.

**Por qué existe**: el egreso hace la pregunta de STOCK, no la de catálogo. Si el catálogo tiene botas negras y esta compra trajo azules, la foto del ítem **desinforma** — y eso es peor que no tener foto, porque el propósito de la miniatura es justamente no confundir ítems parecidos. Solo hace falta fotografiar cuando la compra se ve distinta de lo que dice el catálogo, que es cuando además se llena la `observacion`.

- **Endpoints** (`super_admin`/`admin`/`responsable_almacen`, y el service acota por almacén): `POST` y `DELETE /ingresos/:id/detalles/:detalleId/imagen`. El service comprueba que el lote **sea de ese ingreso**: sin eso el id del ingreso en la ruta sería decorativo y se podría tocar un lote de otro almacén pasando un `detalleId` ajeno.
- **Siguen abiertos con el ingreso ya CONFIRMADO**, y es la ÚNICA excepción a que las líneas queden congeladas: la foto no mueve saldo, precio, correlativo ni Kardex, así que no hay nada contable que corregir anulando. Además es lo que el almacén necesita — registra el ingreso cuando llega el material y carga las fotos después. Un ingreso **ANULADO** sí las bloquea.
- **Al CREAR, la subida es un segundo paso**: las líneas no tienen id hasta después de la transacción del POST, así que el archivo viaja en el campo `archivo` del formulario (dentro del schema, para que `reset()` lo limpie solo) y `subirFotosPendientes()` lo sube después. El emparejamiento es **posicional** y no puede ser otra cosa: funciona porque el backend crea los lotes en el orden de las líneas y `ingresoFullSelect` los devuelve `orderBy: { id: 'asc' }`. Si falla, el ingreso **ya está registrado**: se avisa qué fotos faltaron y se cargan desde la edición.
- **`useImagenLote` NO invalida el detalle del ingreso**, a propósito: la página lo vuelca en el formulario con `reset()` dentro de un efecto, así que un refetch borraría lo que el usuario esté escribiendo en la cabecera. La foto recién subida se pisa con un `Map` local (`fotosCambiadas`) — el mismo recurso de `ItemFormDialog`, adaptado a que acá hay varias fotos por pantalla. Sí invalida `stock` y `egresos`, que es donde la foto la ve otro.

## Roadmap de construcción actual

Fase en curso: construir todo lo que NO depende de las reglas de Ingreso/Egreso aún pendientes de validar con el encargado de almacenes (ver sección de pendientes más abajo). Orden sugerido:

```
1. Setup del monorepo + docker-compose (Postgres) — YA HECHO (cascarón del proyecto ya existe)
2. schema.prisma (Unidad, Almacen, Usuario, UsuarioAlmacenObservado, Partida, Item) + migración + seed de partidas
3. auth (JWT + guards) — solo login, sin registro público
4. usuarios (CRUD + validaciones de unicidad por rol: aprobador único por unidad, responsable_almacen único por almacén)
5. unidades (CRUD simple)
6. almacenes (CRUD simple)
7. partidas (solo lectura del árbol jerárquico + activar/desactivar; NO se crean partidas a mano, vienen del seed)
8. items (CRUD + generación automática de código {partida.codigo}-{correlativo})
9. proveedores (CRUD simple) — YA HECHO
```

Con el paso 9 termina todo el backend que NO depende de reglas pendientes.

**Integración del frontend — infraestructura de auth YA HECHA**:
- `src/lib/token-storage.ts`: tokens en `localStorage`, fuera de React (los lee el interceptor).
- `src/lib/api.ts`: instancia de axios + `Authorization` automático + **refresh en 401 con
  single-flight** (varias peticiones que fallan a la vez comparten una sola llamada a
  `/auth/refresh`). Expone `getApiErrorMessage()` (normaliza el `message` string|array de NestJS)
  y `setSesionExpiradaHandler()` (el interceptor avisa al AuthProvider cuando la sesión murió).
- `src/lib/query-client.ts`: `QueryClient` que NO reintenta errores 4xx.
- `src/features/auth/`: `AuthProvider` (rehidrata la sesión con `GET /auth/me` al montar),
  hook `useAuth`, `useLogin`, tipos espejo del backend (`Rol`, `AuthUser`) y `auth-storage.ts`.
- `src/routes/ProtectedRoute.tsx`: `ProtectedRoute` (privadas, recuerda el `from`) y
  `PublicOnlyRoute` (el login no se ve con sesión abierta). Los dos miran solo la SESIÓN.
- `src/routes/RutaConPermiso.tsx`: acota una ruta a un `Permiso` (2026-08-07). **Cada ruta lleva el
  mismo permiso con el que `NavMain` decide mostrar su ítem** — si agregás una pantalla, va en los dos
  lados. Hasta esa fecha las rutas solo pedían sesión, así que tipear `/kardex` o `/usuarios` con
  cualquier cuenta abría la pantalla entera y todas sus consultas fallaban con 403. **No es una
  barrera** (esa es el backend): es para que una URL a mano, un favorito viejo o un enlace pegado en un
  chat no terminen en una pantalla rota. Muestra un aviso en vez de redirigir en silencio — mandar al
  inicio sin decir nada se lee como que el enlace está roto.
  Dos rutas usan un permiso **distinto al de su listado**, porque abrirlas es otra acción:
  `ingresos/nuevo` va con `ingresosEscribir` y `egresos/nuevo` con `egresosCrear`.

**`GET /auth/me` devuelve el PERFIL, no el token** (cambio del 2026-07-30): va a la BD y agrega
`nombre`, `cargo`, y `unidad`/`almacen` con sus nombres — el token solo lleva ids, y el nombre de
una unidad puede cambiar sin que nadie vuelva a loguearse. `POST /auth/login` devuelve **la misma
forma** (los dos llaman a `AuthService.perfil`). Con eso una pantalla puede mostrar de quién es el
documento antes de que el documento exista: es lo que usa el formulario de egreso para mostrar
solicitante, unidad y almacén al crear. El cache de `localStorage` (`auth-storage.ts`) ya no es
indispensable y quedó solo para pintar la barra lateral sin parpadeo mientras `/auth/me` viaja: al
rehidratar se pisa el objeto ENTERO con la respuesta del servidor.

**Piezas compartidas ya construidas** (reutilizarlas en cada CRUD nuevo, no reinventarlas):
- `features/auth/lib/permisos.ts`: mapa `PERMISOS` que **espeja los `@Roles(...)` de cada
  controlador** + helper `tienePermiso(user, permiso)`. La UI solo OCULTA; quien autoriza es el
  backend. Si cambia un `@Roles` allá, hay que actualizar este archivo.

  **Los REPORTES son de `super_admin`, `admin`, `responsable_almacen` y `observador_almacen`**
  (permiso `reportes`, 2026-08-07) — los cuatro «Registro de ingresos», «Registro de egresos», los dos
  «Estado de almacenes» y el de kardex. Es **más acotado que ver las pantallas de las que salen**: el
  `solicitador` y el `aprobador` consultan stock y sus egresos porque lo necesitan para armar y firmar
  un pedido, pero emitir el registro del almacén no es parte de su trabajo. Ingresos y kardex ya venían
  así por los `@Roles` de su controlador; **egresos y stock necesitaron un `@Roles` propio en el método
  `reporte`**, porque el de la clase es más ancho. Acá sí hay endpoint que proteger, a diferencia de
  `egresosImprimir`.

  **No confundir con los PDF de un DOCUMENTO**, que son otra cosa y siguen sus propias reglas: la *nota
  de ingreso* se arma con `GET /ingresos/:id` (ya limitado a esos cuatro roles) y la *solicitud de
  materiales* con `egresosImprimir`, que es **más estricto todavía** —`super_admin`, `admin` y
  `responsable_almacen`, sin el observador— porque el documento oficial lo emite el almacén.
- `components/data/NumeroDocumento.tsx`: el número de un ingreso o egreso en las TABLAS —correlativo
  en negrita y **la gestión en curso escondida**, porque sería el mismo año en todas las filas. El
  formato (`003-2026`, con guion) sale de `numeroDocumento()` en `lib/formato.ts`; el detalle y el
  porqué están en «El número de documento también sale de ahí», más abajo.
- `components/data/DataPagination.tsx`: pie de paginación de los listados (no usa
  `ui/pagination` de shadcn porque ese renderiza `<a href>` y la página es estado local). Trae
  selector de **filas por página** (10/20/30/50) y **números de página con elipsis** (siempre
  primera + última + ventana alrededor de la actual). El estado (página + tamaño) lo maneja el
  hook `hooks/use-pagination.ts`, compartido por los 5 listados: cambiar el tamaño o cualquier
  filtro reinicia a la página 1 (`resetPage`), porque los índices anteriores dejan de valer. El
  tamaño inicial es **`PAGE_SIZE` de `lib/types.ts` (10)**. El backend sigue con `pageSize=20`
  por defecto para quien consuma la API directo; el frontend siempre lo manda explícito.
- **Los listados se envuelven SIEMPRE en `rounded-md border bg-card shadow-sm`** y la fila de
  encabezados lleva `bg-muted`, que ya viene puesto en `ui/table.tsx` (2026-08-03). No es
  decoración: en modo **claro** `--card` y `--background` son los dos blanco puro, así que el
  `bg-card` no dibuja ninguna superficie y la tabla quedaba apoyada solo en un borde `0.925`
  —se perdía contra la página—. En oscuro no pasaba porque ahí los dos tokens sí difieren. Dos
  cosas que se olvidan al copiar el patrón: el contenedor de `Table` lleva `rounded-[inherit]`
  para que el fondo del encabezado no asome en escuadra por encima de las esquinas redondeadas,
  y una tabla **anidada** (la de lotes en `StockPage`, dentro de una fila ya tintada) pisa el
  fondo con `bg-transparent` — dos superficies encima se enturbian.
- `hooks/use-debounced-value.ts`: para los buscadores (no una petición por tecla).
- `components/ui/sonner.tsx` + `<Toaster>` en `main.tsx` para feedback de mutaciones. Va
  **`position="top-center"`** (2026-08-03, pedido del usuario): el sistema se usa en pantallas
  anchas y arriba a la derecha el aviso caía lejos de donde estaba la vista. OJO: el
  generador de shadcn lo trae importando `useTheme` de `next-themes`; se reconectó al
  `ThemeProvider` propio y se desinstaló `next-themes`. Si se regenera, revisar ese import.
- **Tema claro/oscuro**: `components/theme-provider.tsx` (propio, tres estados —
  `dark`/`light`/`system`— persistidos en `localStorage` bajo la clave `theme`) y
  `components/ThemeToggle.tsx`, el **switch** de la cabecera, al lado del `UserMenu`. El
  **default es `dark`** y se pasa explícito en `main.tsx`; solo rige para quien nunca eligió.
  Cuatro detalles que cuestan descubrir:
  - El tema se aplica **dos veces**: un script inline en `index.html` pone la clase en el
    `<html>` **antes del primer pintado**, y recién después el provider toma el control en su
    efecto. Sin el script la app pintaba en blanco y saltaba a oscuro en cada carga. Si cambiás
    la clave de storage o el default, **hay que tocar los dos lados**.
  - El provider expone **`resolvedTheme`** (`theme`, o el del sistema si vale `"system"`), que es
    lo que el switch necesita para saber si va prendido. Lo sigue **`useSyncExternalStore`** sobre
    el `matchMedia` y NO un `useState` + efecto: el lint del repo rechaza `setState` dentro de
    `useEffect`, y así el valor ya está en el primer render. Ese hook reemplazó al listener que el
    efecto montaba aparte — ahora la suscripción al modo del sistema está en un solo lugar.
  - La lógica de alternar vive en `toggleTheme` del provider, compartida con el atajo de teclado
    «d». Duplicarla es olvidarse del caso `system`, que salta al CONTRARIO del que rige. Alternar
    **saca** el tema de `"system"`: elegir a mano es decir que no se siga al SO.
  - El switch está armado **sobre el primitivo de Radix directamente** (del paquete unificado
    `radix-ui`, que ya es dependencia), no sobre un `ui/switch.tsx`: de un wrapper genérico habría
    que pisar tamaño, colores de los dos estados, pulgar y recorrido —todo salvo el cableado— y
    además necesita meterle hijos al riel. **Emite `data-state="checked"`, no el `data-checked` de
    `checkbox`/`radio-group`** de este mismo repo: es cosa de `@radix-ui/react-switch`, así que
    copiarle las clases al checkbox deja un switch que no reacciona al prenderse.
  - **Forma**: píldora de 52×28 con el sol y la luna dibujados SIEMPRE dentro del riel (izquierda y
    derecha) y el pulgar tapando al del modo que no rige — o sea que el mismo movimiento descubre
    uno y cubre el otro, sin lógica de mostrar/esconder. Prendido = oscuro = pulgar a la
    **izquierda**: el sentido lo da el ícono que queda a la vista, no de qué lado cae el pulgar.
  - **El riel va `bg-primary`**, el verde institucional, en los dos modos (2026-08-07). Fue
    `bg-foreground` —el inverso de la página— hasta esa fecha: resolvía lo mismo (que el switch se
    note) pero dejaba una píldora negra en modo claro que se leía como algo apagado y ajeno a la
    paleta. Los íconos van de `primary-foreground`, el par del riel. Lo que NO hay que hacer es
    pintarlo del color del MODO —negro en oscuro, como la referencia original—: ahí se confunde con
    el fondo de la cabecera y no se ve, que era el problema del switch más viejo.

**Módulo `unidades` — YA HECHO** (plantilla a copiar para el resto): `unidades.types.ts`,
`unidades.schema.ts` (zod espejo del DTO), `unidades.api.ts`, `useUnidades.ts` (queries +
mutations con toast e invalidación), `UnidadFormDialog.tsx` (crear/editar en un solo diálogo),
`UnidadesPage.tsx` (buscador + filtro de estado + tabla + baja lógica con confirmación).
Detalle de permisos: unidades es uno de los tres módulos donde `admin` **lee pero no escribe**
(los otros son `almacenes` y `partidas`), así que la página oculta el botón "Nueva unidad" y la
columna de acciones para ese rol — `AlmacenesPage` hace lo mismo con `almacenesEscribir`.

**Módulos de frontend ya hechos**: `unidades`, `almacenes`, `usuarios`, `partidas`, `items`,
`proveedores`, `fuentes-financiamiento`, `ingresos`, `stock`, `kardex`, `egresos`.

Notas propias de `ingresos` (el más complejo; usa subcarpetas `components/`, `hooks/`, `pages/`):
- Son **páginas con ruta**, no diálogo: `/ingresos` (listado), `/ingresos/nuevo` y `/ingresos/:id`
  (mismo `IngresoFormPage` para crear/editar/ver). **Ya no hay borrador**: `/ingresos/nuevo` registra
  el ingreso definitivo de una (botón *Registrar ingreso*). Un ingreso **CONFIRMADO** se abre con la
  **cabecera documental editable** (factura, respaldos, proveedor, solicitante, unidad — botón
  *Guardar cambios*) pero las líneas, el almacén, la fuente y la fecha de remisión quedan **fijos**
  (tocan stock/correlativo); para corregir eso se **anula** y se registra de nuevo. La **fecha de
  ingreso** aparece solo al editar (al crear la pone el backend) y está deshabilitada salvo para
  `super_admin` — lo decide `puedeCorregirFecha`, y `aPayloadEdicion(v, { incluirFecha })` es lo que
  evita que el campo viaje para los demás roles y el backend responda 403. Un **ANULADO** se
  ve en solo lectura. La partición editable/fijo la controlan `bloqueoCabecera` (solo se bloquea si
  está anulado) y `bloqueoStock` (se bloquea apenas deja de ser nuevo) en `IngresoFormPage`.
- **Impresión**: el botón *Imprimir* del ingreso genera un **PDF de verdad con `pdfmake`** y lo abre en
  una pestaña con el visor del navegador (miniaturas, zoom, descargar, imprimir), igual que el sistema
  anterior — que lo armaba en el servidor con PHP. Todo vive en
  `features/ingresos/lib/nota-ingreso-pdf.ts`. Por qué así y no de otras formas: en el navegador evita
  meterle un Chrome headless al backend on-premise, y sale **vectorial** (texto seleccionable, nítido a
  cualquier zoom), no una captura como daría html2canvas. Detalles que cuestan descubrir:
  - `pdfmake` es **CommonJS**: la instancia llega en `.default` del `import()` dinámico. Usar los
    nombres sueltos del namespace NO funciona — sus métodos vienen del prototipo y el interop no los
    expone (`addFontContainer is not a function`).
  - Fuente **Helvetica** (`pdfmake/build/standard-fonts/Helvetica`), una de las 14 que todo lector de
    PDF ya trae: 300 KB en vez de los 854 KB del vfs de Roboto, y no se embebe en cada archivo.
    `@types/pdfmake` no declara ese módulo; la declaración está en `src/pdfmake.d.ts`.
  - Las medidas van en **puntos** (1 in = 72 pt): hoja Carta 612x792, márgenes de 34 pt (12 mm), y los
    anchos de tabla suman **544**, que es el ancho útil.
  - Los logos se embeben en CADA PDF, por eso `public/iniaf/logo-*.png` están generados al tamaño que
    ocupan en la hoja a 300 dpi y no más (el PDF pasó de 268 KB a 88 KB al ajustarlos).
  - `import()` dinámico de pdfmake y `window.open("", "_blank")` **sincrónico** en el clic: si la
    pestaña se abriera después de generar, el navegador la bloquearía como emergente. Si aun así la
    bloquea, se descarga el archivo.
  Todo ingreso ya tiene número (se estampa al crear), así que **siempre se puede imprimir**. El monto
  en letras sale de `lib/numero-literal.ts` (compartido, lo va a reusar el egreso). El detalle imprime
  `DESCRIPCIÓN (observación de la línea)`. El pie de firmas replica el del sistema anterior: un
  recuadro **ANTECEDENTES** con la observación, espacio en blanco y los cargos *Encargado Almacén ·
  Unidad Solicitante · VoBo Jefe Administrativo* (son rótulos fijos, no salen de la BD). Un ingreso
  **ANULADO** lleva marca de agua cruzada (`watermark` de pdfmake), etiqueta bajo el número y el
  detalle de quién lo anuló al pie.
  **Membrete**: INIAF a la izquierda, Ministerio a la derecha y al centro el título, el almacén, el
  número y la **fecha de ingreso**. Esa fecha va pegada al número a propósito: la gestión del número
  (`001-2026`) sale de ella, así que juntas se explican solas. No es la fecha de remisión, que es del
  documento del proveedor y vive abajo, en el bloque de respaldos. Agregarla no cambia el alto del
  membrete: el bloque central suma ~48 pt y lo que manda es el logo del Ministerio (~59 pt). Los archivos son `public/iniaf/logo-iniaf.png` + `logo-ministerio.png`, versiones reducidas
  con `sharp` de los originales que también están en esa carpeta. El logo del INIAF ya trae el nombre
  completo de la institución, por eso el encabezado NO lo repite en texto.
- `components/IngresoLineas.tsx` es el wrapper de **`useFieldArray`** para las líneas (agregar/quitar
  ítems, subtotal por línea y total en vivo). Era la pieza pendiente que faltaba construir. Cada línea
  lleva: Ítem · **Unidad** (solo lectura, deriva del ítem) · Cantidad · Precio unit. · Subtotal · 🗑,
  y debajo una **Observación** por línea (opcional, `IngresoDetalle.observacion`; se imprimirá como
  "DESCRIPCIÓN (observación)" en el reporte). La fila usa **grilla de 12 columnas** (`sm:grid-cols-12`
  + `col-span-*` por campo); el pie del Total replica esa grilla para caer bajo la columna Subtotal.
- **Layout de la cabecera** (`IngresoFormPage`): grilla de **12 columnas** plana (sin secciones), cada
  campo con su `col-span` (cortos ¼ = `col-span-3`, selectores ½ = `col-span-6`, Observación full).
- **OJO — Certificación**: es un campo real (`ingresos.schema.ts` + backend). Se cayó por accidente en
  un refactor y se restauró; hoy está en la cabecera junto a los otros números de documento. **No
  volver a borrarlo.** (Pendiente menor: confirmar con el usuario su posición final en la grilla.)
- El selector de ítem **busca contra el servidor** (el catálogo real tiene ~23k ítems y no entra en el
  navegador): `useBuscarItems(termino)` es un `useInfiniteQuery` que pide tandas de 50 (`q`, resuelto
  en el backend sin acentos y con índice GIN sobre código+descripción) y `ComboboxField` recibe
  `search`/`onSearchChange`, con lo que **cmdk deja de filtrar en memoria** (`shouldFilter={false}`).
  La tanda siguiente la pide `onEndReached` (scroll infinito: `onScroll` de React sobre `CommandList`,
  distinto del listener nativo de `wheel`, que resuelve otra cosa). **OJO con el efecto de cascada**:
  al cambiar el término la lista sigue scrolleada abajo y, como el disparador es estar cerca del fondo,
  se encadenan tandas solas (se vio: 11 páginas pedidas sin que nadie scrollee). Lo evitan dos guardas
  que NO hay que sacar: el `ComboboxField` manda la lista arriba cuando cambia `search` **o cuando
  cambia la primera opción** (el reemplazo de resultados llega ~300 ms después de tipear; apilar una
  tanda no lo dispara porque agrega al final), y `cargarMas` no pide nada mientras haya una búsqueda en
  vuelo (`isFetching`). El hook va con **`gcTime: 0`** para que toda búsqueda arranque en 50: sin eso,
  volver a un término ya visitado (típico: vaciar el filtro) revive de la caché las tandas apiladas
  antes ahí. Paginar así es correcto porque
  `items.service` desempata el orden por `id`; sin ese desempate, dos ítems con la misma descripción
  podrían repetirse o perderse entre tandas. Dos piezas hacen que el ítem ya
  elegido no se quede sin etiqueta cuando la lista cambia: `itemsIniciales` (los del propio ingreso,
  que llegan por props desde `IngresoFormPage`) y el registro de lo elegido en esta sesión, que se
  guarda **al elegir** vía `onSelectOption` (no en un efecto: el lint del repo — reglas del React
  Compiler — rechaza `setState` dentro de `useEffect` y refs leídos en render).
- El botón principal (*Registrar ingreso* al crear, *Guardar cambios* al editar) es el `submit` del
  `<form id="ingreso-form">`. Al crear, el POST hace todo en el backend (número + lotes + Kardex); si
  falta un respaldo, **el backend lista qué falta** y llega como toast (la validación dura NO se
  duplica en el front). Al editar se manda solo la cabecera vía `aPayloadEdicion()` (no viajan líneas,
  almacén, fuente ni fecha). El payload de creación es `aPayload()`; ambos en `ingresos.schema.ts`.
- Los selectores dependen del almacén: `useUnidadesDeAlmacen(almacenId)` trae las unidades que ese
  almacén muestra. El `responsable_almacen` no elige almacén (usa el suyo, se muestra el nombre).
- **Permisos**: para armar un ingreso el `responsable_almacen` necesita leer cosas que son de admin,
  por eso existen `GET /usuarios/solicitadores` (lista chica) y la lectura de `almacenes` abierta a
  ese rol. Si agregás un selector nuevo, revisá que su endpoint permita al `responsable_almacen`.

Los módulos simples siguen la misma
plantilla de 6 archivos (`*.types.ts`, `*.schema.ts`, `*.api.ts`, `use*.ts`, `*FormDialog.tsx`,
`*Page.tsx`). Notas propias de `usuarios` (el más complejo):
- El schema de Zod es una **función** `usuarioSchema(esEdicion)`: al crear, la contraseña es
  obligatoria; al editar, vacía significa "no cambiar" y no viaja en el PATCH.
- Los campos unidad / almacén / almacenes observados se muestran según el rol, replicando
  `ROLES_CON_UNIDAD` y `ROLES_CON_ALMACEN` del service (ver `usuarios.types.ts`).
- El payload se arma **según el rol**, no según lo que quedó en el formulario: si el usuario
  eligió un rol, cargó una unidad y después cambió de rol, ese valor viejo no se envía (el
  backend responde 400 si llega una unidad para un rol que no la lleva).
- La UI NO valida unicidad de roles (un aprobador activo por unidad, etc.): eso lo resuelve el
  backend con mensajes claros que se muestran como toast.
- No se puede desactivar la propia cuenta (el botón queda deshabilitado).
- `useUnidadesActivas()` / `useAlmacenesActivos()` (en los features respectivos) alimentan los
  selectores del formulario.

Notas propias de `partidas` (no sigue la plantilla: es solo lectura + activar/desactivar):
- **No usa el endpoint paginado ni paginación**: el catálogo entero son ~120 nodos (~29 KB), así
  que se trae el árbol completo con `GET /partidas/arbol` una sola vez y **el filtrado es local**
  (`partidas.filtros.ts`). Eso permite conservar los ancestros de cada coincidencia, cosa que un
  listado plano paginado no puede hacer. Si el catálogo creciera mucho (otros grupos del
  clasificador), habría que rever esta decisión.
- El filtro local normaliza acentos en JS igual que `f_unaccent` en el servidor.
- Al haber filtro activo se expande todo el árbol; si no, las coincidencias quedarían escondidas
  dentro de nodos colapsados y parecería que no hay resultados.
- Desactivar **no** cascadea a los hijos en los datos (cada nodo conserva su `activo`), pero rige
  un **"activo efectivo"**: una hoja es asignable a ítems solo si ella Y toda su cadena de
  ancestros están activas. Así, desactivar un grupo (o cualquier padre) inhabilita toda su rama
  para asignar ítems, y se rehabilita al reactivar el padre — sin perder el estado individual de
  las hojas. Se valida en dos lados: el backend al crear ítems (`items.service.ts`, recorre
  `padreId` hacia arriba) y el frontend en `usePartidasSeleccionables` (filtra el árbol propagando
  el estado de los ancestros). El diálogo de confirmación de baja lo explica cuando el nodo tiene
  hijos.

Notas propias de `items`:
- **`lib/api.ts` NO fija un `Content-Type` por defecto**, a propósito. Axios lo infiere del cuerpo
  (`application/json` para objetos, `multipart/form-data` con boundary para `FormData`). Si se
  volviera a poner el default JSON, axios convertiría el `FormData` a JSON (`formDataToJSON`) y
  la subida de imágenes se rompería **en silencio**.
- `lib/files.ts`: las imágenes se sirven fuera del prefijo de la API, así que la URL se arma
  contra el **origen** del backend (`new URL(VITE_API_URL).origin`), no contra `VITE_API_URL`.
  Ahí también viven los límites (5 MB, JPG/PNG/WebP) que espejan `uploads.config.ts`.
- `ImageField` **no es un campo de react-hook-form** como el resto de los `*Field`: la imagen usa
  endpoints propios y se aplica al instante, sin esperar al submit. Por eso recibe la URL actual
  y dos callbacks en vez de `control`/`name`.
- **Al crear se puede elegir la imagen**, aunque el endpoint necesite un id que todavía no existe:
  el archivo se guarda dentro del formulario (campo `archivo` del schema, así `reset()` lo limpia
  solo y no hace falta `useState`) y se sube en un segundo request después del POST. El
  `ImageField` tiene por eso dos modos: `archivoPendiente` (preview local con `createObjectURL`,
  creación) e `imagenUrl` (subida inmediata, edición).
- **Si el ítem se crea pero la imagen falla**, el diálogo NO se cierra: llama a `onCreado(item)`,
  la página pasa a editar ese ítem y el mismo diálogo se convierte en el de edición, donde
  reintentar es un clic. Se avisa con un toast de advertencia que incluye el código generado.
  El tamaño y el formato se validan **al elegir el archivo**, antes del POST, para que el caso
  más probable de fallo no llegue a crear nada.
- En edición la partida se muestra como texto, no como selector: el backend no admite cambiarla
  (el código deriva de ella).
- `ComboboxField` (nuevo, compartido) es el selector con buscador para listas largas — acá se usa
  para las 90 partidas asignables. Su base `ui/command.tsx` se escribió a mano porque
  `shadcn add command` exige sobrescribir `dialog.tsx`, que ya está en uso.

Notas propias de `proveedores` (cierra el frontend de esta fase):
- **Asimetría del NIT vacío**, verificada contra el backend: al CREAR hay que **omitir** los
  opcionales vacíos (`CreateProveedorDto` marca el NIT con `@IsNotEmpty`, así que `""` da 400);
  al EDITAR, en cambio, `""` es justamente lo que limpia el campo (el service lo normaliza a
  `null`). Lo resuelve el helper `soloConValor()` del `ProveedorFormDialog`.
- El **nombre se puede repetir a propósito** (la razón social se escribe de formas distintas) y
  varios proveedores pueden no tener NIT; el único conflicto posible es un NIT repetido (409).
- Es el único módulo que `responsable_almacen` ve: entra a leer (necesita el selector al
  registrar un ingreso) pero no puede crear ni editar.

**Estado**: con esto termina todo el frontend que NO depende de reglas pendientes. Lo que sigue
(`stock`, `ingresos`, `egresos`, `kardex`, `reportes`) requiere primero confirmar las reglas de
negocio con el encargado de almacenes — ver `docs/preguntas-encargado-almacenes.md`. Al agregar cada uno hay que sumar su entrada en
`NavMain.tsx` (`ITEMS`) y en `SECCIONES` de `DashboardLayout.tsx`.

**INGRESOS: YA IMPLEMENTADO** (backend + frontend). **Sin borrador** (quitado el 2026-07-27). Flujo:
**crear** = `POST /ingresos` registra el ingreso `CONFIRMADO` en UNA transacción: valida respaldos + ≥1 ítem, que el responsable sea `solicitador` activo y que la unidad pertenezca al almacén; estampa `fechaIngreso` = **ahora**, `gestion` = año de esa fecha y `numero` = `MAX+1` por almacén+gestión; crea los lotes con `saldoCantidad = cantidad` y una ENTRADA de Kardex por línea (fechada con `fechaIngreso`). Si falta un dato, responde la lista de pendientes y **no crea nada**.
→ **editar** (`PATCH /ingresos/:id`, solo `CONFIRMADO`): cambia la cabecera documental (factura, respaldos, proveedor, responsable, unidad). NO toca líneas, almacén, fuente ni fecha de remisión (el `UpdateIngresoDto` ni siquiera los acepta), así que el stock queda intacto. **La excepción es `fechaIngreso`**, que solo acepta de `super_admin` y que sí mueve el Kardex y el correlativo (ver la entidad `Ingreso` más arriba).
  **El responsable de recepción se valida SOLO si cambia**: reenviar el que ya tenía se acepta aunque hoy esté dado de baja. Si no, dar de baja a esa persona dejaba el ingreso imposible de editar —ni siquiera para corregir la factura— porque el formulario reenvía su id. Regla general: **los catálogos filtran activos para lo NUEVO; los documentos ya emitidos conservan su referencia.** El frontend la acompaña con `conReferenciaActual()` en `IngresoFormPage`, que agrega al selector lo que el ingreso ya referencia con la etiqueta «(inactivo)» — aplicado al responsable y al proveedor.
→ **anular** (`POST /ingresos/:id/anular`, solo CONFIRMADO; bloqueado si algún lote ya tuvo salidas; crea REVERSION, pone saldo 0 y registra quién/cuándo/motivo).
Un ingreso NO se borra nunca (no existe DELETE): un error se corrige anulando y registrando de nuevo. **No hay endpoint `confirmar` ni `remove`** (eran del borrador; se eliminaron).
**Scope por almacén** (lo aplica el service): `responsable_almacen` solo SU almacén, `observador_almacen` solo los que observa, admin/super_admin todo.
El número se imprime `001-2026` (`padStart(3)` + guion + gestión) — se deriva, NO se guarda
formateado. El formato lo arma **`numeroDocumento()` de `lib/formato.ts`**, uno solo para ingresos y
egresos (ver «El número de documento» más abajo).

**Listado de ingresos — buscador, columna Total, filtro de almacén y rango de fechas** (2026-08-03):
- **El buscador `q` mira `proceso_c31`, `certificacion` y `observacion`** — antes eran nota de
  remisión, C31 y Nº de factura. Son los datos por los que de verdad se busca un ingreso. La
  migración `20260803150000_ingresos_busqueda_campos` crea los índices GIN de los dos campos nuevos y
  **dropea los de las columnas que ya no se consultan**: un índice GIN de trigramas no es gratis, se
  mantiene en cada INSERT/UPDATE de la tabla.
- **`total` lo calcula el backend** y viaja en la fila del listado. No es una columna de la tabla ni
  se puede resolver con un `groupBy` de Prisma, que agrega columnas sueltas y no un PRODUCTO
  (`cantidad × precio`): `ingresoListSelect` trae las líneas, `totalDeLineas()` las suma y el `map`
  las descarta, así el listado sigue devolviendo la forma liviana. **Se quitó la columna Proveedor**
  (el dato sigue viajando; lo usa el filtro `proveedorId` de la API).
- **El filtro de almacén** se muestra a quien ve más de uno (`admin`, `super_admin`,
  `observador_almacen`), igual que la columna Almacén. Para que funcionara hubo que arreglar
  **`filtroAlmacen()`** en `common/scope/`: ignoraba el `almacenId` pedido si el usuario tenía scope
  propio, así que el observador —que ve varios— no podía filtrar entre ellos. Ahora **el scope acota
  y la query afina**: se intersectan, y pedir uno fuera del scope devuelve *ninguno*, no *todos*. El
  cambio es del helper compartido, así que también arregla stock. Y se abrió `GET /almacenes` al
  `observador_almacen` (necesita los NOMBRES para el selector; leer el catálogo no dice nada de qué
  puede ver de cada almacén — eso lo acota `almacenesPermitidos`).
- **El rango de fechas es sobre `fechaIngreso`**, la de efecto contable, NO sobre la de remisión: así
  el reporte coincide con lo que movió el Kardex. Ambos extremos **inclusivos** — `hasta` se lleva al
  día siguiente y se compara con `lt`, porque la fecha guardada tiene hora y un `lte` sobre la
  medianoche dejaría afuera todo lo registrado ese día. Se interpretan en **UTC**, igual que el
  kardex.
  Lo elige **`components/data/DateRangeFilter.tsx`** (`Popover` + `Calendar` en modo `range`, dos
  meses a la vista y atajos *Este mes · Mes pasado · Esta gestión · Gestión anterior*). No es un campo
  de react-hook-form —como sí lo es `DatePickerField`— sino un filtro suelto: recibe valor y callback.
  **El panel NO se cierra solo al elegir**, igual que el Range Picker de shadcn. Cerrarlo «cuando el
  rango esté completo» parece buena idea y NO funciona: en react-day-picker v9 el PRIMER clic ya
  devuelve `{from: X, to: X}` —los dos extremos en el mismo día—, así que la condición se cumple
  enseguida y el panel se cierra antes de poder elegir el segundo día. Los atajos sí cierran: aplican
  un rango entero de una. No reponer el auto-cierre.
  Reemplazó a dos `<input type="date">`, con los que había que tipear las dos fechas sin ver el
  calendario y nada impedía cerrar un rango al revés. **La fecha se serializa con `aIsoLocal()` de
  `lib/fechas.ts`, NO con `toISOString()`**: en un huso negativo (Bolivia, UTC-4) el ISO devuelve el
  día anterior para todo lo elegido antes de las 20:00, y un rango del 1 al 31 viajaría como 31/12 al
  30/01. Ese helper vive suelto porque un archivo que exporta un componente no puede exportar además
  funciones sin romper el fast-refresh de Vite.
- **Reporte «Registro de ingresos»** (`GET /ingresos/reporte` + `lib/reporte-ingresos-pdf.ts`, y
  desde el 2026-08-07 también `reporte-ingresos-excel.ts`): una
  línea por documento con `Nº · Nº ingreso · fecha · [almacén] · observación · total`, sin paginar y
  en orden **cronológico ascendente** (en el papel se lee como un libro, no como una bandeja).
  **Va APAISADO** desde el 2026-08-07, como los otros cuatro: en vertical la observación —la única
  columna de largo impredecible— se partía en varios renglones por fila. La
  **columna Almacén solo aparece sin filtrar almacén**: con uno elegido repetiría el mismo nombre en
  cada fila y además ya está en la línea «OFICINA:» de la cabecera — misma regla que en las
  pantallas. Al ocultarla, sus 120 pt se los queda la observación y el `colSpan` del total baja de 5
  a 4 (pdfmake exige tantas celdas vacías como columnas absorba). El
  endpoint **va declarado ANTES de `@Get(':id')`** o Nest lo tomaría por un id y reventaría el
  `ParseIntPipe`. Comparte el `where` con el listado (`armarWhere`) para que el papel no pueda
  desalinearse de la pantalla; en el frontend eso lo sostiene un único objeto `filtros` que usan los
  dos. **Los ANULADOS salen pero no suman**: en gris, con el importe entre paréntesis y una nota al
  pie con cuántos fueron y por cuánto. Ocultarlos haría que el reporte no cuadre con el listado, que
  sí los muestra.

**STOCK (consulta): YA IMPLEMENTADO** — `GET /stock` + página `/stock`, solo lectura.

**No hay tabla de existencias**: el saldo vive en cada línea de ingreso (el LOTE) y el stock de un
ítem es la **suma de los saldos de sus lotes**. El service agrupa `ingresoDetalle` por `itemId`
(`groupBy` + `_sum`), pagina los ítems ordenados por descripción —el orden sale de `items`, porque
Prisma no ordena un `groupBy` por campo de otra tabla, y desempata por `id`— y recién ahí trae los
lotes de esa página. Los lotes vienen **del más antiguo primero por `fechaIngreso`** (no por la
fecha de remisión: esa es del documento del proveedor y puede no tener relación con cuándo el
material quedó disponible), que es el orden en que se va a
proponer consumirlos. Filtros: `q` (código/descripción), `almacenId`, `fuenteFinanciamientoId`,
`partidaId`, `itemId` y `conSaldo` (default `true`; en `false` incluye agotados). Filtrar por fuente
**recalcula el saldo**, no solo esconde lotes: el mismo filtro alimenta el `groupBy` y el detalle.

**Partida**: los ítems se ordenan por `partida.codigo` y la pantalla encabeza cada grupo
(`32100 · Papel`), igual que el reporte «consolidado por ítem» — que desde el 2026-08-03 agrupa **solo
por partida** y lleva la fuente en columna (antes abría un bloque por financiador, como el sistema
anterior; el encargado pidió el cambio porque un ítem comprado con tres fuentes aparecía en tres
lugares distintos del papel). El selector se alimenta de **`GET /stock/partidas`** y NO del catálogo de
partidas: leer ese catálogo está reservado a `admin`/`super_admin` (ver `PERMISOS`) y quien más mira
el stock es el `responsable_almacen`; además así solo se ofrecen partidas que tienen existencias. Ese
endpoint reusa el mismo `where` que el listado, salvo el propio filtro de partida.

**El scope por almacén salió a `common/scope/almacenes-permitidos.ts`** y lo comparten ingresos y
stock (y lo va a usar egresos): `null` = sin restricción (admin/super_admin), array = esos almacenes,
array vacío = ninguno. Duplicar esa regla es lo que hace que un rol nuevo se arregle en un lado y se
olvide en otro.

**Reportes imprimibles** — menú «Reportes» de la pantalla, los DOS del sistema anterior. Ambos salen
de **`GET /stock/reporte`** (sin paginar; un reporte no se pagina y agregar en el servidor evita
mandar miles de lotes al navegador) y respetan los filtros que estén puestos en pantalla:

| Reporte | Qué es | Archivos |
|---|---|---|
| **Estado de almacenes consolidado por ÍTEM** | El DETALLE: cada ítem con cantidad, precio y valor, agrupado por **partida**, con la **fuente como COLUMNA** de cada renglón y subtotal por partida. Cada fila es **ítem + fuente + precio** (el lote, sumando los que comparten los tres: en el papel dos lotes iguales son indistinguibles). | `estado-almacenes-pdf.ts` · `estado-almacenes-excel.ts` |
| **Estado de almacenes consolidado por PARTIDA** | El RESUMEN contable, sin ítems: cuánta plata hay por **partida** y dentro por **fuente**, con subtotal por partida. Es una reagrupación del mismo dato, así que los dos **siempre cuadran**. Sin filtrar almacén agrega **«— NACIONAL»** al título y omite la línea de OFICINA — en el sistema anterior eso era una tercera entrada de menú; acá es el mismo reporte con el filtro vacío. | `estado-consolidado-pdf.ts` · `estado-consolidado-excel.ts` |

Los **nombres los fijó la institución el 2026-08-03** (antes: «Estado de almacenes» y «Estado
consolidado de almacenes y suministros»). Nombran el eje por el que agrupa cada uno, que es lo único
que los diferencia. En el código el `TipoReporteStock` sigue siendo `"detalle" | "consolidado"`: son
identificadores internos y renombrarlos no cambiaría nada de lo que ve el usuario.

Los dos comparten membrete, pie y formatos en **`lib/reporte-comun.ts`** — si cada uno armara su
encabezado, en dos cambios dejan de verse hermanos. Agregan lo que el reporte viejo no traía:
subtotales, total general y «Página N de M». Ese archivo **vivía en `features/stock/lib/`** y se
movió a `lib/` cuando lo necesitó el reporte de ingresos: importar de otro feature es la señal de
que la pieza ya no era de ese feature. Su `encabezadoReporte` acepta una **`leyenda`** opcional que
reemplaza el «AL: …» cuando el reporte es de un PERÍODO y no una foto a una fecha.

**Los formatos numéricos son UNO SOLO: `lib/formato.ts`** (2026-08-03). Tres funciones, y los tres
casos NO se muestran igual aunque los tres sean números: **`moneda`** (importes) siempre con 2
decimales, porque un total contable se lee en columna y tiene que alinearse · **`cantidad`** sin
decimales cuando es entera —se cuentan paquetes y piezas, así que «195,00 PAQUETE» sobra: es `195`—
y con 2 solo si hay fracción · **`precio`** con 2 decimales de piso y hasta 5 si los tiene, sin ceros
de relleno: la columna es `Decimal(12,5)` porque un unitario puede ser fino (`0,00125` el gramo), no
porque todo precio tenga cinco decimales, y `25,00000` era ruido que además desalineaba la columna.
`lib/reporte-comun.ts` las **re-exporta** para los PDF: un reporte que redondea distinto de la tabla
de la que salió es un reporte que no cuadra. Antes cada pantalla y cada PDF tenían su propio helper.

**El número de documento también sale de ahí: `numeroDocumento()`** (2026-08-07). Dos cosas cambiaron
a la vez y conviene no separarlas:

- **El separador es GUION, no barra: `003-2026`** (pedido de la institución). `003/2026` se leía como
  una FECHA —marzo de 2026— y en los listados cae al lado de dos columnas que sí son fechas: el ojo
  agrupa por patrón. La constante es `SEPARADOR_DOCUMENTO`.
- **Se arma en UN solo lugar.** Al ir a cambiar el separador apareció el problema de fondo: el mismo
  string se construía a mano en **nueve** —los dos `etiquetaNumero`, tres reportes PDF, el Excel, el
  selector de lotes, la pantalla de stock y un toast—, así que tocarlo en uno dejaba los otros ocho
  como estaban. `etiquetaNumero()` de ingresos y de egresos hoy **delegan** en `numeroDocumento()` y
  se conservan solo porque las usan ~20 lugares; `lib/reporte-comun.ts` la re-exporta para los PDF.
  Sin número devuelve «—» (un borrador de egreso todavía no lo tiene, se estampa al enviar).

**En las TABLAS lo dibuja `components/data/NumeroDocumento.tsx`**, no el string pelado:

- el correlativo en **negrita**, sin tamaño propio — hereda el de la tabla. Agrandarlo lo sacaba de
  la línea base y desalineaba la columna: lo que lo destaca es el peso, no el cuerpo;
- **la gestión EN CURSO no se muestra.** Sería el mismo año repetido en todas las filas, y casi todo
  lo que se mira es del año corriente. Aparece SOLO en documentos de gestiones anteriores, que es
  cuando el dato dice algo — y ahí salta a la vista en vez de perderse entre cientos de repeticiones.
  Se compara **dentro del render**, así una pestaña abierta al cambiar de año no queda mostrando la
  gestión vieja.

Nada de esto cambia el FORMATO: el número completo va igual en el `title` —se corrió a donde no
estorba, no se borró— y los documentos impresos siguen diciendo `003-2026` entero.

**La base de los PDF vive en `lib/pdf.ts`** (carga de pdfmake con el interop de CommonJS, fuente
Helvetica y los logos como data URL); la nota de ingreso y este reporte la comparten y cada uno pone
solo su maquetado. **Su hermana para Excel es `lib/excel.ts`** — ver «Los cinco reportes salen
también en Excel» al final de esta sección.

En el frontend, `StockPage` es una tabla por ítem con **fila desplegable**: al abrir un ítem se
muestra una sub-tabla con sus lotes (ingreso `001-2026`, fecha, fuente, proveedor, precio unitario,
saldo/cantidad y valorizado). La columna Almacén —tanto en el filtro como en los lotes— sigue la
misma regla que el listado de ingresos: solo para quien ve más de uno.

**KARDEX (consulta): YA IMPLEMENTADO** — `GET /kardex` + página `/kardex`, solo lectura.

Es el libro de UN ítem en UN almacén: el saldo corriente no significa nada si se mezclan ítems o
almacenes, así que `itemId` es obligatorio y el almacén se exige (el `responsable_almacen` usa el
suyo). No hay tabla de saldos: cada renglón acumula los movimientos, que es lo que permite auditarlo.
Muestra además el **saldo de apertura** (todo lo anterior a la gestión pedida): sin esa línea, el
saldo de la primera fila parece salir de la nada.

**El signo de un movimiento sale del documento que lo origina, NO del tipo** (`KardexService.signo`):
ENTRADA suma y SALIDA resta, pero una REVERSIÓN depende de qué revierte — la de un ingreso deshace
una entrada (resta) y la de un egreso devolverá material (sumará). Cuando exista egresos, esa función
es el único lugar a tocar.

A diferencia del sistema anterior, **la fuente es un filtro opcional**: allá hay que elegir una sí o
sí y no existe vista consolidada; acá, sin filtro, salen todas juntas. Desde la pantalla de stock,
cada ítem tiene un atajo «Ver kardex» que lleva el ítem y el almacén por la URL.

**Filtros: gestión → almacén → fuente → rango de fechas → ítem** (2026-08-04). Van de lo general a lo
específico, que es como se acota una consulta al libro; el ítem queda último porque es el que más
texto muestra (para quien elige almacén se pasa entero a la segunda fila).

**El rango de fechas MUEVE el saldo de apertura**, no solo esconde renglones: pedir marzo abre con el
saldo al 1/3, no con el de enero — si no, el saldo corriente de la primera fila no cerraría. Lo
resuelve `ventana()` en `kardex.service`, compartida por la pantalla y el reporte: sin rango la
ventana es la gestión entera (del 1/1 al 31/12), con rango mandan los extremos, ambos inclusivos y en
UTC.

**El ítem sigue siendo obligatorio en la PANTALLA** (confirmado con el usuario el 2026-08-04): el
saldo corriente no significa nada mezclando ítems. El reporte es el que sale de todos — esa es la
división de trabajo entre los dos, no un olvido.

**Reporte de kardex** (`GET /kardex/reporte` + `lib/reporte-kardex-pdf.ts` y `-excel.ts`,
2026-08-03): calcado del
que emitía el sistema anterior. Dos diferencias con el kardex de PANTALLA, y son el sentido del
reporte:
- **Sale de TODOS los ítems del almacén**, no del que esté elegido. El `itemId` del `QueryReporteKardexDto`
  es **opcional** (en el de pantalla es obligatorio) y solo sirve para acotarlo. Por eso el botón no
  exige ítem: pide almacén y gestión.
- **Separa por FUENTE aunque no se filtre.** En pantalla, sin filtro, las fuentes salen juntas —es lo
  cómodo para operar—; en el papel cada financiador rinde su plata por separado, así que **cada
  ítem+fuente es un BLOQUE** con su cabecera, su saldo de apertura, sus totales y su línea de
  observaciones para anotar a mano. Cada bloque arranca en hoja nueva: así se puede separar el
  archivo por ítem, como se guardaba en papel.
Doce columnas (cantidad y valor del mismo movimiento, por separado) obligan a hoja **apaisada**. Solo
salen los bloques con movimientos en la gestión o con saldo que viene de antes: un ítem que nunca tocó
ese almacén no imprime una hoja en blanco.

El selector de ítems (búsqueda contra el servidor, tandas de 50) vive en `features/items/useBuscarItems.ts`
porque lo comparten el formulario de ingreso y el kardex.

**EGRESOS — YA IMPLEMENTADO** (2026-07-29): backend, frontend y el PDF de la solicitud.

Endpoints: `GET /egresos` (+ `pendientesMios=true` = la bandeja de cada rol) · `GET /egresos/:id` ·
`POST /egresos` (borrador) · `PATCH` / `DELETE` (solo borrador, solo su dueño) · `POST /:id/enviar` ·
`/aprobar` · `/rechazar` · `/entregar` · `/anular`.

- **La línea apunta al LOTE** (`ingresoDetalleId`), no al ítem: el ítem, la fuente y el precio de la
  salida se derivan de él. Por eso la SALIDA del Kardex sale valorizada al precio de ESE lote.
- **La reserva vive en `common/stock/reserva.ts`**, compartida con `stock`. `disponible = saldo −
  reservado`, y `reservado` se deriva de las líneas cuyo egreso está pendiente **o** en un borrador de
  menos de `HORAS_RESERVA_BORRADOR` (48). El vencimiento es una condición del `where`: **no hay cron**
  — uno que falle dejaría stock reservado que nadie puede liberar. Si hay que subirlo a 72 h, es esa
  constante.
- **El descuento al entregar es un UPDATE condicional** (`saldoCantidad >= cantidad` + `decrement`),
  no un leer-y-escribir: la base garantiza que el saldo no quede negativo. Además, `bloquearLotes()`
  hace `SELECT … FOR UPDATE` (SQL crudo; Prisma no lo expresa) al crear/editar/enviar, para que dos
  solicitantes no reserven a la vez el mismo último saldo.
- **El alcance NO es solo por almacén**, a diferencia de ingresos/stock: el `solicitador` ve LOS SUYOS
  y el `aprobador`, los de SU UNIDAD (`EgresosService.alcance`). El decorador `@Roles` dice quién
  puede intentar una acción; el service dice **sobre qué**.
- **El `solicitador` ahora lee `stock`** (`stock.controller` + `almacenesPermitidos`): su pedido
  apunta a un lote, así que necesita ver cuáles hay y con cuánto disponible. Está en el helper de
  scope y no solo en el `@Roles` — si no, abrirle el endpoint le mostraría los otros ocho almacenes.
- **Descartar un borrador lo BORRA de verdad**, a diferencia de todo lo demás: todavía no es un
  documento (no tiene número) ni tocó stock.
- El **número se estampa al enviar** y **el rechazo lo conserva** (el pedido rechazado vuelve a
  BORRADOR pero ya es un documento con serie).

Notas del frontend (`features/egresos/`, con subcarpetas `components/`, `hooks/`, `pages/`):
- **Una sola página para todo el ciclo**: `EgresoFormPage` es formulario editable si el pedido es un
  BORRADOR **propio**, y ficha de solo lectura con botonera si no. Qué botones aparecen sale del
  **estado + rol** (`puedeAprobar`, `puedeEntregar`, `puedeAnular`), no de un permiso global: el mismo
  usuario ve «Aprobar» en un pedido y nada en otro.
- **El listado se organiza en PESTAÑAS por etapa del ciclo** (2026-08-07). Reemplazaron al par «botón
  Solo mi bandeja + selector de estados»: eran dos controles con formas distintas contestando la misma
  pregunta —«¿qué quiero ver?»— que además se pisaban, y por eso el botón de Reporte tenía que cambiar
  los dos por atrás.

  | Pestaña | Estados | Nota |
  |---|---|---|
  | **Mi bandeja** | (según rol) | Filtra con `pendientesMios`, no con estados: la regla es del backend (`filtroBandeja`) |
  | **Sin enviar** | `BORRADOR` | Solo para el `solicitador` |
  | **En curso** | `PENDIENTE_APROBADOR` + `PENDIENTE_RESPONSABLE_ALMACEN` | Lo que ya circula. **Era lo que no se podía expresar antes** |
  | **Cerrados** | `ENTREGADO` + `ANULADO` | Los que movieron stock. Es de lo que se hace el reporte |
  | **Todos** | — | El cajón |

  **«Mi bandeja» NO es un grupo hermano de los otros: es el subconjunto de «En curso» que espera una
  decisión mía.** Entender eso es lo que ordena todo el diseño — mientras era un botón al lado del
  selector de estados, no había forma de que la pantalla lo dijera.

  `BORRADOR` queda fuera de «En curso» a propósito: sin enviar no tiene número, no es un documento y
  solo le importa a su dueño; meterlo ahí le llenaría la vista al almacén de pedidos que quizás nunca
  se envíen. **Qué pestañas ve cada rol** lo decide `vistasDe()`: el solicitador cambia bandeja por
  «Sin enviar»; admin, super_admin y observador no llevan ninguna de las dos, porque nada los espera.

  **El selector de estado sigue existiendo pero ACOTADO a la pestaña**: solo ofrece los estados de la
  etapa que se mira, así no se puede armar una combinación imposible (Cerrados + Pendiente de envío)
  que devuelva cero filas sin decir por qué. En «Mi bandeja» ni se muestra: esa pestaña ya ES un
  estado. Cambiar de pestaña **limpia** el estado elegido — los de una etapa no existen en la otra.
- **Los números de las pestañas salen de `GET /egresos/resumen`**, endpoint propio y no derivado del
  listado: el listado está paginado y filtrado, así que su `total` responde a lo que se esté mirando,
  no a cuánto hay en las otras etapas. Devuelve `bandeja` (**`null`** si el rol no tiene — distinto de
  `0`, que sería «te corresponde y está vacía»), `sinEnviar`, `enCurso` y `cerrados`, todo dentro del
  alcance del usuario. **Sin los números las pestañas no resuelven el problema que las motivó**: abrir
  la bandeja vacía y no saber que había trabajo en otra parte.
- **El mismo resumen alimenta el BADGE del menú lateral** (`NavMain`), con el número de la bandeja al
  lado de «Egresos». Vive ahí y no en la pantalla a propósito: la gracia es enterarte de que tenés
  trabajo **sin entrar al módulo**. Solo se pide a los roles con bandeja propia (`enabled`) y solo se
  dibuja con algo pendiente — un «0» permanente es ruido. Cuelga de `egresosKeys.all`, así que toda
  mutación de egresos ya lo invalida: aprobar un pedido baja el número solo.
  **Se descartó ponerle un desplegable al ítem del menú** con las tres vistas: la barra lateral es el
  mapa de los MÓDULOS, y los filtros van pegados a los datos. Si Egresos tuviera tres puertas, ¿por qué
  no Ingresos o Stock? El menú dejaría de ser un mapa y sería un árbol; y los contadores obligarían a
  consultar egresos en todas las pantallas del sistema.
- **El botón «Reporte» LLEVA a la pestaña «Cerrados»** (2026-08-07). El registro es de lo que salió del
  almacén: entregados y anulados. **No era cosmético** — el total sumaba pedidos pendientes, material
  que sigue en la estantería, y encima por la cantidad SOLICITADA, que ni siquiera es la que va a salir
  (la ajusta el responsable al entregar); un borrador, además, salía con «—» donde va el número. Mueve
  la **pantalla** en vez de filtrar solo el PDF para que los dos sigan diciendo lo mismo —la razón por
  la que `filtros` es un objeto único— y para que se vea por qué el listado cambió.
  Desde el 2026-08-07 el botón es un desplegable con **PDF y Excel** (`reporte-egresos-pdf.ts` y
  `-excel.ts`; ver «Los cinco reportes salen también en Excel»): la pestaña la mueve igual, sea cual
  sea el formato — el filtro es de los DATOS, no de la salida.
- **El filtro `estado` admite VARIOS valores**, separados por coma (`?estado=ENTREGADO,ANULADO`). El DTO
  lo normaliza con `toStringArray` (`common/dto/transforms.ts`) y valida con `@IsEnum(..., { each: true })`;
  el service usa `estado: { in: [...] }` siempre, porque uno solo es el caso de un elemento — mandarlo
  suelto sigue funcionando. En el frontend las listas son `ESTADOS_CON_MOVIMIENTO` y `ESTADOS_EN_CURSO`
  (`egresos.types.ts`), y las aporta la pestaña. `egresos.api.ts` lo serializa con coma en `aParams()`
  y no deja que lo haga axios (mandaría `estado[]=A&estado[]=B`, que hoy también anda pero depende de
  cómo esté configurado el parser de query de Express y no se ve en ningún lado).
- **Las tarjetas del Inicio siguen funcionando igual de finas**: un `?estado=X` abre SU pestaña y queda
  elegido dentro de ella (`vistaDe()`), así que el enlace no pierde precisión.
- **La bandeja vacía ofrece la salida donde está el ojo**: el mensaje «No tenés pedidos esperando tu
  decisión» lleva un botón que nombra lo que hay del otro lado («Ver los 7 pedidos en curso»), y solo
  aparece si de verdad hay algo. Las pestañas ya muestran el número, pero el que mira una tabla vacía
  está mirando la tabla, no la barra de arriba.
- **`useBuscarLotes`** (en `hooks/`) alimenta el selector: pide `GET /stock` de a 30 ítems y aplana a
  lotes, **descartando los de `disponible === 0`**. El sistema anterior ofrecía lotes agotados y de ahí
  salen sus saldos negativos. Como el combo busca contra el servidor, `EgresoLineas` recibe
  `lotesIniciales` (los del propio pedido): sin ellos un lote ya elegido aparecería en blanco — y encima
  puede estar en cero justamente porque **este** pedido lo reservó.
- **La etiqueta del lote es `descripción` + la NOTA resaltada + `disp. N unidad · fuente` en gris**
  (2026-07-30; la nota se sumó el 2026-08-07). Ni la
  fecha ni el número de ingreso: el selector viejo los traía y solo alargaban la línea — para elegir de
  dónde sale el material lo que decide es la fuente, que es de quien hay que rendir la plata. El número
  sigue estando donde importa (el diálogo de la foto y la ficha del pedido). No reponerlos.
- **La observación del LOTE es lo único que distingue dos lotes del mismo ítem** (comparten código,
  descripción y —salvo foto propia— también la imagen), así que se muestra en TODOS lados. Es del
  **lote**, no de la línea de egreso, que no lleva observación propia a propósito.
  - En el **selector** va en `ComboboxOption.nota`, que el combo dibuja como **etiqueta con fondo**
    (`EtiquetaOpcion`), en la lista y también en el botón cerrado. Antes iba entre paréntesis dentro
    del `label`, en el mismo tono que el resto, y se leía como parte del nombre del ítem — o sea que
    no cumplía su única función. Si el resaltado fuera solo de la lista desaparecería justo al
    elegir, que es cuando conviene seguir viendo cuál se eligió.
    **La etiqueta es NEUTRA (gris), no del color de acción**: la fila resaltada de la lista se pinta
    con ese mismo color, así que una etiqueta primaria quedaba color sobre color y desaparecía justo
    en la opción que se está mirando. Sobre la fila resaltada invierte al par `accent`/
    `accent-foreground`, igual que la descripción.
  - En **texto** va como `DESCRIPCIÓN (nota)` vía `descripcionConNota()` (`egresos.types.ts`), la
    misma convención con la que la nota de ingreso imprime la suya. La usan el título del diálogo de
    la foto, la ficha, `EntregaDialog` y el PDF de la solicitud. Mostrarla en uno solo deja al que
    ENTREGA sin el dato que tuvo el que pidió.
  - **Límite conocido**: el buscador del servidor no la mira (`q` va contra código y descripción del
    ítem); haría falta su propio índice GIN. El filtro local de cmdk sí (está en `textoCmdk`).
- **El lote muestra su FOTO**: miniatura en cada opción de la lista desplegada y junto a la
  línea elegida, ampliable en un diálogo (`FotoLote` en `EgresoLineas`). Sirve para no confundir ítems
  de descripción casi igual. Es **`lote.imagenUrl ?? item.imagenUrl`** (ver "Foto por lote" arriba): manda
  la del lote si le sacaron una al recibirlo, y si no cae en la del catálogo. Las dos viajan en
  `GET /stock` y en `GET /egresos/:id`,
  y se vuelven URL absoluta con `urlArchivo()` (las estáticas van fuera del prefijo de la API). El soporte
  es del `ComboboxField` compartido (`ComboboxOption.imagen`): si **alguna** opción trae foto, las que no
  muestran un marco vacío del mismo tamaño para que las filas no queden en zigzag.
  **La ficha del pedido también la muestra**, como primera columna de la tabla de líneas
  (`MiniaturaLote` en `EgresoFormPage`, `size-10`, sin rótulo en el encabezado — la miniatura se
  explica sola). Usa el mismo fallback; sin ninguna foto dibuja un marco vacío del mismo tamaño para
  que las filas no cambien de alto.
  **El botón cerrado del combo NO lleva miniatura**: lo haría más alto que los campos vecinos y
  desalinearía toda la fila. `FotoLote` va **fuera del grid**, como bloque flex de la tarjeta, y mide
  `size-16` = 64 px: el alto exacto de un campo con su rótulo (20 + 8 + 36), así llena la tarjeta de
  arriba abajo sin desalinear nada. Dentro del grid gastaba una columna de ~115 px para dibujar 36.
- **Los estados en curso son UNA serie: «Pendiente de envío / de aprobación / de entrega»** (elegido por
  el usuario el 2026-07-30). Cada uno nombra el paso que falta, en el registro formal de la institución.
  **Si cambiás uno, cambiá los tres**: que dos sigan un patrón y el tercero otro es exactamente lo que
  hace que un estado se lea como de otro sistema. Rige también en los títulos de las tarjetas del inicio.
- **La palabra «borrador» NO se le muestra al usuario**: hablaba del documento en vez del paso pendiente
  y sonaba a algo sin terminar. **El enum de la BD sigue siendo `BORRADOR`** —renombrarlo costaría una
  migración sin ganancia— así que la palabra vive en el código y en los comentarios, pero no en pantalla:
  revisá los toasts y los diálogos si tocás esto.
- **Dos juegos de etiquetas de estado**: `ESTADO_LABEL` es la de los badges y `ESTADO_DETALLE` la
  explícita, que nombra a QUIÉN espera el pedido («Esperando al aprobador de unidad») — va en el selector
  de filtros y en el campo Estado del PDF, que se lee sin el contexto de la pantalla.
- **Las columnas que serían siempre iguales no se muestran**: al `solicitador` se le oculta *Solicitante*
  (su alcance son solo SUS pedidos, así que repetiría su nombre en cada fila) y a quien ve un solo
  almacén se le oculta *Unidad*. El `colSpan` de los estados vacíos se calcula sumando las condicionales
  — si agregás una columna, actualizá esa cuenta.
- **Vocabulario: «aprobador de unidad», NO «jefe de unidad»** (2026-07-30) — es como se llama el rol
  en el sistema (`Rol.aprobador`). Rige en toda la UI: estado, historial, botón *Enviar a aprobador
  unidad*, toasts. **El PDF es la excepción**: su pie de firmas dice «Jefe de Unidad» porque replica el
  documento oficial del sistema anterior. **Se cambió a «Aprobador de Unidad» el 2026-07-30** por pedido
  del usuario, y el pie pasó de 4 casillas a **3**: *Aprobador de Unidad · Encargado de Almacenes ·
  Recibí conforme*. La casilla «Solicitante» se quitó porque quien pide es quien recibe — su nombre
  salía dos veces en el mismo pie, y una tercera arriba en el bloque de datos.
- **Enviar pide confirmación y NOMBRA al destinatario** (`EnviarDialog`, compartido por la ficha y el
  listado): enviar no tiene vuelta atrás —el solicitante ya no puede editar ni cancelar— así que no se
  dispara de un clic. El destinatario sale de **`GET /usuarios/mi-aprobador`** (el aprobador activo de
  MI unidad; abierto al `solicitador` aunque no lea el padrón, porque es de su propia unidad y devuelve
  una sola persona). Si la unidad no tiene aprobador activo el diálogo lo advierte en rojo pero **deja
  enviar**: el backend tampoco lo impide y el pedido queda esperando, que es la regla acordada (no hay
  suplencia).
- **Si la validación falla, se avisa**: `handleSubmit(guardar, avisarInvalido)` saca un toast diciendo
  qué falta, y `EgresoLineas` pinta el error del arreglo (ej. «Agregá al menos un ítem»), que no lo
  pinta ningún campo. Sin las dos cosas el botón *Guardar* parecía no hacer nada cuando el problema
  estaba en las líneas, más abajo en la página.
- **Al crear, se vuelve al LISTADO** (`navigate("/egresos")`, 2026-08-03). Antes se quedaba en la
  ficha del pedido recién creado y se leía como que el botón no había hecho nada. El listado
  además es donde viven las acciones del borrador (enviar, editar, descartar). El pedido nuevo
  aparece arriba de todo: el orden es `createdAt desc` y el `solicitador` no tiene bandeja, así
  que el filtro `pendientesMios` arranca apagado para él y no se lo esconde.
- **Las acciones del borrador viven en el LISTADO, no en la ficha**: editar (✏), enviar (➤) y descartar
  (🗑) son iconos de fila, y solo aparecen si el borrador es PROPIO (`egreso.solicitante.id === user.id`,
  lo mismo que exige el backend — un admin ve borradores ajenos y tampoco puede tocarlos). En la ficha
  quedan únicamente los pasos del circuito: *Guardar* y *Enviar a aprobador unidad*.
- **La cabecera de la ficha NO repite unidad/almacén/solicitante**: eso vive en el bloque de datos, que
  va FUERA del `<form>` para verse igual en edición y en lectura. Un pedido sin número muestra
  «Pedido» a secas, no «Pedido —».
- **El historial se ve DESDE el listado**, con un ícono ⏱ «Ver historial» en cada fila que abre un panel
  lateral (`HistorialSheet`, sobre el `Sheet` de shadcn). Ver quién movió el pedido es lo que más se
  consulta y antes costaba entrar a la ficha. El panel **se monta recién al abrirse**: el historial no
  viaja en el listado (`GET /egresos` devuelve la forma liviana), así que pide el detalle — montarlo
  siempre dispararía una consulta por fila. La línea de tiempo vive en `HistorialEgreso` y la comparten
  el panel y la ficha: el dato es uno solo y tiene que contarse igual en los dos lados.
- **El historial narra ACCIONES, no estados** (`describirPaso` en `egresos.types.ts`): cada renglón
  dice qué hizo la persona («Aprobó el pedido») y a quién le queda la pelota («pasa al almacén»), y se
  deriva de la transición `estadoAnterior → estadoNuevo`. Antes mostraba solo el estado nuevo, así que
  se leía «Esperando entrega · PEDRO FERRANO» — que describe dónde quedó el pedido pero omite lo único
  que importa del renglón: que Pedro lo aprobó. Se dibuja como línea de tiempo; los pasos que frenan el
  circuito (rechazo y anulación) llevan el punto en rojo.
- **El disponible se muestra como un campo más, pegado a Cantidad** (rótulo arriba, valor en negrita en
  un renglón de la misma altura), no como una nota gris al costado: es el dato contra el que se escribe
  la cantidad. Se pone **en rojo apenas lo pedido lo supera**, con un aviso corto. Es solo un aviso —
  quien rechaza sigue siendo el backend al guardar (`validarDisponibilidad`), porque el disponible
  puede haber cambiado mientras se llenaba el formulario.
- **Un lote NO puede repetirse en dos líneas** (el mismo ÍTEM sí, desde lotes distintos). Si se repitiera,
  cada línea mostraría el disponible entero sin descontar lo que pide la otra y se podría pedir el doble
  de lo que hay. Se sostiene en tres lugares: el backend lo rechaza (`validarDisponibilidad`, la barrera
  real), el `superRefine` de `egresos.schema.ts` lo marca en la línea culpable, y `opcionesPara(indice)`
  de `EgresoLineas` directamente **no ofrece los lotes tomados por las otras líneas** — que es lo que
  evita llegar al error.
- **Quitar una línea es una «X» en la esquina de la tarjeta**, no un 🗑 en la fila: así no gasta una
  columna del grid (se la queda el selector de lote, que es el que más texto necesita) ni entra en la
  alineación de los inputs. **`IngresoLineas` sigue el mismo patrón** desde el 2026-07-31, para que los
  dos formularios de líneas se vean hermanos: la «X» cae sobre la columna Subtotal, así que esa celda y
  el pie del Total llevan `pr-7` para dejarle lugar (antes el 🗑 vivía dentro de la celda y el Total
  descontaba su ancho con `pr-11`).
- **El botón «Agregar ítem» va DEBAJO de las líneas, a todo el ancho**, en los dos formularios: es donde
  el ojo termina de leer la última fila. Punteado con el color primario, para leerse como «acá se agrega
  otra» sin competir con el submit, que es el único sólido. **Las clases están duplicadas en
  `EgresoLineas` y `IngresoLineas` y tienen que quedar IGUALES**: si retocás una, retocá la otra.
- **`EntregaDialog` se monta solo al abrirse** (`{dialogoEntrega && <EntregaDialog …/>}`) y calcula las
  cantidades propuestas en el `useState`. Sincronizarlas con un efecto sería `setState` dentro de
  `useEffect`, que el lint del repo rechaza.
- **Toda mutación invalida `stock` y `kardex`** además de `egresos` (`useInvalidarEgresos`): crear,
  editar, enviar, rechazar y descartar mueven la RESERVA, y entregar/anular mueven el saldo. Sin eso el
  disponible que ve el solicitante queda viejo.
- **Impresión** (`lib/solicitud-pdf.ts` + `hooks/useSolicitudPdf.ts`): «SOLICITUD DE MATERIALES Y/O
  SUMINISTROS DE ALMACEN», hermana de la nota de ingreso — misma base de `lib/pdf.ts`, mismo membrete
  (con la fecha de ENVÍO bajo el número, que es de la que sale su gestión), mismos estilos y hoja Carta
  apaisada de 724 pt útiles. Columnas del reporte anterior: `Nº · Código · Descripción · Fuente ·
  Partida · Unidad · Cant. solicitada · Cant. despachada`. **El recuadro «Programa» NO va**: la
  categoría se eliminó. El pie imprime los nombres de quienes ya actuaron (solicitante, jefe de unidad
  —sale del historial—, encargado) sobre líneas para firmar a mano. Un ANULADO lleva marca de agua.
  **Solo la imprimen `responsable_almacen`, `admin` y `super_admin`** (`egresosImprimir`), NO el
  solicitante ni el aprobador de unidad: el documento oficial lo emite el almacén. Ojo: eso **oculta el
  botón, no es una barrera** — el PDF se arma en el navegador con datos que `GET /egresos/:id` ya
  devuelve, así que no hay endpoint que proteger.
  Se abre en una **PESTAÑA nueva**, como todos los PDF del sistema (ver abajo). Un BORRADOR no se
  imprime: todavía no tiene número.

**TODOS los PDF se abren en una PESTAÑA nueva** (unificado el 2026-08-03, por pedido del usuario). Se
había probado un visor embebido en un diálogo (`PdfDialog` + `useVisorPdf`, con el PDF como object URL
dentro de un `<iframe>`); **no gustó y se eliminó** — no reponerlo. El patrón único vive en
`lib/pdf.ts`:

- **`abrirPestanaPdf()`** se llama DENTRO del gesto del clic, **antes de cualquier `await`**. Si la
  pestaña se abriera después de generar el documento, el navegador la bloquearía como emergente. Este
  es el detalle que se olvida al copiar el patrón a un módulo nuevo.
- **`mostrarPdf(ventana, documento, nombre)`** vuelca el PDF en esa pestaña y, si el navegador la
  bloqueó igual, lo descarga — la única salida que queda sin pestaña.
- Si algo falla, el `catch` hace `ventana?.close()`: si no, queda una pestaña en blanco abierta.

Lo usan **los siete**: los dos documentos (nota de ingreso y solicitud de egreso) y los cinco
reportes (registro de ingresos, registro de egresos, los dos estados de almacenes y el de kardex).

## Los cinco reportes salen también en EXCEL (2026-08-07)

Alcanza al **registro de ingresos**, al **registro de egresos**, a los **dos estados de almacenes** y
al **kardex** — o sea a los reportes de listado, NO a los dos documentos (nota de ingreso y solicitud
de materiales), que son papel oficial y siguen siendo solo PDF.

**Es el MISMO documento del PDF** —logos, título, membrete y tabla—, por pedido de la institución: el
Excel no es una exportación de datos pelada. Lo que sí agrega, porque era gratis y es la razón por la
que alguien pide Excel:

- **los importes son NÚMEROS y las fechas son FECHAS.** Un total que no se puede sumar es la foto de
  un total;
- **los subtotales y totales son fórmulas `SUM()`**: si alguien corrige una fila, todo lo demás se
  acomoda. En los estados de almacenes el total suma **las celdas de subtotal** y no el rango entero
  — sumar el rango contaría dos veces, porque los subtotales están adentro;
- los dos registros llevan **autofiltro**, y todos menos el kardex la fila de encabezados
  **congelada**;
- todo queda listo para **imprimirse parecido al PDF**: apaisado, ajustado al ancho de una página y
  repitiendo el encabezado en cada hoja (`prepararImpresion`).

**Se eligió ExcelJS y no SheetJS**: la versión community de SheetJS no soporta ni estilos ni
imágenes, así que los logos eran imposibles.

Decisiones que cuestan descubrir, todas en **`lib/excel.ts`** (la hermana de `lib/pdf.ts`):

- **Se importa por su NOMBRE (`import("exceljs")`), no por la ruta del bundle.** Su `package.json`
  declara `browser: ./dist/exceljs.min.js`, así que Vite ya sustituye la build de Node —que arrastra
  `stream` y `fs` y no compila—. Importar la ruta a mano funcionaría igual pero se queda sin tipos.
  Es **UMD**, así que la instancia puede venir en `.default`: el mismo interop que ya mordió con
  pdfmake. El `import()` es **dinámico** y queda en su propio chunk (~930 KB): no pesa en el bundle
  de quien nunca exporta.
- **El Excel NO abre pestaña, se DESCARGA** (`descargarExcel`, un Blob y un `<a download>`). Es la
  única excepción al patrón de arriba y no es un olvido: el navegador no renderiza un `.xlsx`, así
  que abrirle una pestaña lo dejaría mirando una página en blanco. Por eso los hooks hacen
  `formato === "pdf" ? abrirPestanaPdf() : null`.
- **Los logos son objetos ANCLADOS, no contenido de celda**: flotan sobre la grilla, así que las
  filas del membrete llevan alto fijo o el logo taparía las primeras filas de datos. Dónde arranca el
  de la derecha lo calcula **`anclaDerecha()`**, porque `tl.col` de ExcelJS es un índice de COLUMNA y
  no una posición: dónde cae depende de los anchos, que cambian de un reporte a otro. Un número fijo
  dejaba el logo bien en un reporte y en el medio del título en el siguiente.
- **`crearTabla()`** es lo que evita escribir cinco veces la misma estructura (encabezado, filas,
  encabezados de grupo, subtotales, total y notas al pie); cada reporte se queda solo con sus
  columnas y su recorrido. Las filas van **PLANAS**, como en el papel: los grupos abren una fila
  sombreada y cierran con su subtotal, en vez del agrupador plegable de Excel.
- **La CANTIDAD elige su formato por celda** (`#,##0` si es entera, `#,##0.##` si no). Excel no sabe
  expresar «esto es entero»: con un formato fijo un 50 sale como **`50,`** —el separador decimal
  queda dibujado aunque no haya decimales— y no hay condición de formato que lo distinga. Por eso
  `FORMATO_CANTIDAD` es una función y no una cadena.
- **Un valor numérico se escribe como número**, incluida la gestión: como texto, Excel le pone el
  triangulito verde de «número guardado como texto», que se lee como que el reporte tiene un error.

Tres cosas que **NO son olvidos**:

- los **estados de almacenes no llevan autofiltro**: con filas de grupo y de subtotal intercaladas,
  filtrar deja subtotales que ya no corresponden a lo que se ve;
- el **kardex no lleva autofiltro, ni panel congelado, ni fórmulas**: sus totales son un saldo
  CORRIENTE, no la suma de una columna, y ordenar rompería el arrastre; además, con bloques
  encadenados no hay una única fila de encabezados que congelar. A cambio lleva **saltos de página
  manuales** (`rowBreaks`) para que cada bloque arranque en hoja nueva, como el PDF — saltos, no
  pestañas: un libro con cien pestañas sería peor que uno con cien páginas. (`rowBreaks` no está en
  los tipos de exceljs pero sí en su implementación, de ahí el cast.)
- los **anulados se guardan en NEGATIVO** en los dos registros: el formato contable los muestra entre
  paréntesis y así sumar la columna entera da el total real.

**En la UI el botón «Reporte» es un `DropdownMenu`** con las dos salidas —*PDF: para imprimir y
archivar* · *Excel: mismo formato, con filtros y totales calculables*—, y el hook recibe un tercer
parámetro `formato: "pdf" | "excel"` (default `"pdf"`, así ninguna llamada vieja cambió). **`FormatoReporte`
está declarado en los cuatro hooks de reporte** (`useReporteIngresos`, `useReporteEgresos`,
`useReporteKardex`, `useStock`) — si crece a algo más que `"pdf" | "excel"`, conviene subirlo a `lib/`.

NO construir todavía: `reportes` — falta definir cuáles se necesitan.

## Alcance NO incluido (por ahora)

- Transferencias de stock entre almacenes.
- Módulo de Activos Fijos.

## Convenciones de código

- Backend: un módulo NestJS por dominio (`auth`, `usuarios`, `unidades`, `almacenes`, `catalogo`, `stock`, `proveedores`, `ingresos`, `egresos`, `kardex`, `reportes`). Ver estructura completa en `docs/estructura-backend.md`.
  - **Ubicación de los módulos**: todos los módulos de dominio viven dentro de `src/modules/<modulo>/`. `src/prisma/` es infraestructura (no es módulo de dominio) y `src/common/` guarda lo compartido (ej. `common/dto/pagination-query.dto.ts`, `common/dto/paginated-result.ts`). El cliente Prisma generado está en `src/generated/prisma/`.
  - **Instalación de dependencias**: SIEMPRE correr `pnpm add`/`pnpm remove` DENTRO de `backend/` o `frontend/` (nunca en la raíz — no hay `package.json` ni workspace raíz; instalar ahí crea artefactos sueltos y provoca resolución de módulos duplicada).
  - **Listados**: todo endpoint de listado (`GET`) devuelve paginado con la forma estándar `{ data, meta: { total, page, pageSize, totalPages } }`, usando el helper `paginated()`. **Orden: `[{ createdAt: 'desc' }, { id: 'desc' }]`** — lo más reciente primero. El desempate por `id` no es decorativo: varios registros pueden compartir `createdAt` (el seed inserta muchos en el mismo instante) y sin él la paginación puede repetir u omitir filas entre páginas. **Excepción: `partidas`**, que se ordena por `codigo asc` porque el código ES la jerarquía del clasificador. El query DTO de cada módulo **extiende** `PaginationQueryDto` y agrega sus propios filtros + un buscador `q` según los campos de texto de su schema (ej. usuarios busca en `nombre`/`usuario`; unidades en `nombre`/`sigla`). Los DTO de update se definen explícitos (campos opcionales), no con `PartialType`/mapped-types, para no sumar dependencias.
  - **Ordenamiento de selectores (parámetro `orden`)**: los combos/selectores de formulario se ven mejor alfabéticos, pero las TABLAS van por fecha. Se resuelve con un parámetro **`orden`** en el query DTO (validado con `@IsIn`): proveedores/fuentes/almacenes aceptan `orden=nombre`, items `orden=descripcion|codigo`. Si viene, el service ordena por ese campo asc; **sin él, el default sigue siendo por fecha**. Los hooks `*Activos` del frontend (los que alimentan selectores) piden `orden` al backend y **no ordenan en memoria** — así escala cuando el selector de ítems pase a búsqueda contra el servidor.
  - **Buscador `q` (insensible a acentos)**: NO usar `contains` + `mode: 'insensitive'` de Prisma — eso ignora mayúsculas pero NO tildes, así que buscar "almacen" no encontraba "Almacén" (nadie escribe acentos al buscar). Todos los listados usan el helper `buscarIdsPorTexto()` de `common/search/busqueda-texto.ts`, que resuelve el filtro de texto con SQL crudo (`f_unaccent(col) ILIKE f_unaccent($1)`) y devuelve ids; el service los aplica como `id: { in: ids }` y conserva el resto de su lógica Prisma (filtros, orden, paginación, includes). Un array vacío significa "ninguna coincidencia", no "sin filtro". Apoyo en DB: extensiones `unaccent` + `pg_trgm`, función IMMUTABLE `f_unaccent` e índices GIN de trigramas, todo en la migración `20260719161128_busqueda_sin_acentos` (escrita a mano; Prisma no expresa `unaccent` en su DSL). **Al agregar un buscador a un módulo nuevo hay que crear también su índice GIN en una migración**, si no la búsqueda funciona pero hace scan secuencial.
  - **Booleanos en query**: usar el helper `toBoolean` de `common/dto/transforms.ts` con `@Transform`. El `ValidationPipe` global NO usa `enableImplicitConversion` (coacciona mal los booleanos: `Boolean('false') === true`); los numéricos de query llevan `@Type(() => Number)` explícito.
- Frontend: organizado por `features/` (dominio), no por tipo de archivo. Componente `EgresoAprobacion` reutilizado por los 2 roles que aprueban (aprobador, responsable_almacen), variando solo qué acciones habilita.
  - **Estructura híbrida por módulo**: módulos simples (≤5 archivos: unidades, almacenes, proveedores) van planos dentro de `features/<modulo>/`. Módulos complejos (egresos, ingresos, reportes) usan subcarpetas `components/`, `hooks/`, `pages/` dentro de su propia carpeta de feature. No aplicar subcarpetas a todos los módulos por igual.
- Guards de NestJS deben validar scope: `responsable_almacen` solo puede actuar sobre egresos/ingresos de SU `almacen_id`; `aprobador` solo sobre egresos de SU `unidad_id`.
- Nunca borrar registros de Ingreso/Egreso — siempre baja lógica + reversión, con historial.

## Stack de UI del frontend (confirmado)

- **shadcn/ui + react-hook-form + Zod** (NO Ant Design — descartado).
- Componentes de formulario personalizados con sufijo **`*Field`**, no prefijo `Form*` (para no chocar con la familia oficial `Form/FormField/FormItem/FormControl` de shadcn, que no se usa aquí). Todos se componen sobre los primitivos `Field`, `FieldLabel`, `FieldError` de shadcn + `Controller` de react-hook-form, con tipado genérico `<T extends FieldValues>` y `Path<T>` para el `name`.
  - Nombres ya definidos: `InputField`, `SelectField`, `TextareaField`, `DateField`, `ComboboxField`, `NumberField`.
  - `ComboboxField` es obligatorio para elegir Ítem (catálogo grande, un `<select>` normal no escala).
  - Las líneas dinámicas (`useFieldArray`) YA están hechas, pero **una por módulo**: `IngresoLineas` y `EgresoLineas`. No se compartieron porque piden cosas distintas — el ingreso elige ÍTEM y captura precio y observación; el egreso elige LOTE, muestra el disponible y la foto, y no lleva observación.
- Validación con Zod; el schema de cada formulario debe reflejar el DTO/`class-validator` del backend correspondiente, para no duplicar reglas desalineadas entre frontend y backend.

### Mayúsculas automáticas (2026-08-07)

**Todo campo de texto libre del sistema fuerza MAYÚSCULAS mientras se escribe**, para que la carga
quede uniforme sin depender de quién tipea: así figuran los datos en los documentos de la institución.
Rige en `InputField` (por defecto solo si `type="text"`) y en `TextareaField` (siempre). Transforma el
**valor real** del formulario, no con `text-transform` de CSS — eso es maquillaje y enviaría minúsculas
al backend.

Atarlo al `type` y no a un `?? true` pelado es deliberado: un campo nuevo con `type="password"` o
`"email"` no puede heredar el comportamiento sin que alguien lo decida.

**Las dos excepciones, y no hay que sacarlas**: el campo *Usuario* del **login** y el de **alta de
usuarios**, los dos con `mayusculas={false}`. El backend busca la cuenta con `findUnique` sobre ese
valor exacto (`auth.service`), así que forzarlo dejaría a todos afuera, y crear cuentas en mayúsculas
las dejaría sin coincidir con las existentes (`pedro.ferrano`). No es un dato de documento: es un
identificador técnico.

Los **buscadores** de los listados quedan fuera porque no usan `InputField` sino un `Input` suelto con
su propio estado. Da igual funcionalmente —la búsqueda del backend ignora mayúsculas y acentos
(`f_unaccent(col) ILIKE`)— y forzarlas ahí solo se vería agresivo.

**Ojo, el front no es una barrera**: el service sigue normalizando `nombre` y `cargo` porque la API es
la fuente de verdad. Los demás campos hoy dependen solo de la UI — un POST directo a la API puede
guardar minúsculas. Si eso importa, hay que normalizar en cada DTO, que es una decisión por campo
(usuario y códigos NO se tocan).

## Documentos de análisis y decisiones (leer antes de tocar ingresos/egresos/stock)

| Archivo | Qué contiene |
|---|---|
| `docs/decisiones-ingresos.md` | **Lo decidido y lo pendiente de ingresos.** Fuente de verdad del módulo. |
| `docs/decisiones-egresos.md` | **Lo decidido y lo pendiente de egresos.** Cuáles preguntas bloquean el schema y cuáles no. |
| `docs/analisis-sistema-anterior.md` | Cómo opera hoy el INIAF: relevamiento del sistema viejo con cifras verificadas sobre su base (11 gestiones). |
| `docs/preguntas-encargado-almacenes.docx` | Cuestionario para la reunión con el encargado (27 preguntas; lo genera `tools/analisis-legacy/genera-preguntas.js`, no se edita a mano). |
| `tools/analisis-legacy/` | Scripts que producen las cifras del análisis. |

## Pendiente de definición (esperar validación del encargado de almacenes antes de implementar)

**Ingresos** — ya implementado; lo que queda abierto es la **vía de carga inicial del arranque**: los saldos que se traigan del sistema anterior no tienen proveedor/C31/certificación reales, así que necesitan un camino aparte (de administrador). Va junto con la definición del **cierre de gestión** (quién lo ejecuta, cuándo, y si la gestión cerrada se bloquea para movimientos con fecha anterior). Ver `docs/decisiones-ingresos.md` puntos 9 y 13.

**Egresos** — **el encargado respondió el 2026-07-29 y ya NADA bloquea el schema.** Todo lo decidido
está en `docs/decisiones-egresos.md` (niveles, quién ajusta cantidades, quién elige el lote, reserva,
rechazo, cancelación, saltos, ausencias y justificación). Resumen de lo que cambió respecto de lo que
se venía asumiendo: **el aprobador NO ajusta cantidades** (solo el responsable de almacén, y el
solicitador al corregir un rechazo) · **el lote y la fuente los elige el solicitante** (se descartó la
propuesta de que los resolviera el almacén) · **la reserva es desde que se registra** (se descartó
reservar recién con la aprobación del jefe) · **se elimina la categoría/«Programa»** y `actividad`
pasa a llamarse `justificacion`.

También quedaron cerrados: **falta de stock físico al entregar** (el responsable entrega menos con el
ajuste que ya tiene; el pedido queda entregado con la cantidad ajustada) · **anulación de un egreso
entregado** (calcada del ingreso: `responsable_almacen`/`admin`/`super_admin`, motivo obligatorio, sin
plazo salvo gestión cerrada) · **`justificacion` obligatoria, 300 caracteres** · **la partida NO
necesita nada en el schema** (cuelga del ítem; verificado en el código del sistema anterior, que la
imprime por línea y nunca la totaliza en egresos).

Lo que sigue abierto, y **ninguno bloquea escribir el schema**:

- **Devoluciones de material ya retirado.** Anular ≠ devolver: anular dice que la salida nunca debió
  existir. El sistema anterior tenía un documento propio («Ingreso devolución», 21 usos en 11 años,
  ninguno desde 2021) cuyas observaciones parecen correcciones de salidas mal hechas — si es así, la
  anulación alcanza. Sin confirmar; de hacer falta es aditivo.
- Plazos por nivel. **Ojo**: no se pueden estimar con datos del sistema anterior — sus fechas de
  firma nunca se escribieron (constantes `2000-01-01`/`2000-01-02` en 24.664 filas).

**Otros**:
- Reportes específicos requeridos.
- Ancho del padding del correlativo de Ítem: se asumió 6 dígitos (`000001`), confirmar o ajustar.
- ~~El catálogo real del INIAF tiene **23.005 ítems**: `ComboboxField` trae la lista completa al navegador~~ — **resuelto**: el selector de ítems de los ingresos ya busca contra el servidor (ver notas de `ingresos`). Los demás combos (proveedores, fuentes, unidades, partidas) siguen filtrando en memoria, que es lo correcto para listas chicas.

**Ya resuelto (no volver a preguntar)**: cierre de gestión con arrastre automático de saldos · sin mínimos/máximos por ítem · stock por lote · separación por fuente de financiamiento · sin migración de históricos.
