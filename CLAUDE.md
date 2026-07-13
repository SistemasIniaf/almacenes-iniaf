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

- **Unidad**: nombre, sigla, activo. Área administrativa (ej. Unidad de Planificación).
- **Almacen**: nombre, activo. Cada institución tiene 9+.
- **Usuario**: username (no email), password (hash bcrypt), nombre, activo, `unidad_id`, `almacen_id`, `rol`. `almacen_id` es INDEPENDIENTE de `unidad_id` (no están ligados).
- **Roles**: `super_admin`, `admin`, `solicitador`, `aprobador`, `responsable_almacen`, `central`, `observador_almacen`.
  - `super_admin`: sin unidad ni almacén. Acceso total.
  - `admin`: sin unidad ni almacén. Igual que super_admin salvo que NO gestiona Unidades ni Partidas.
  - `solicitador`: unidad y almacén requeridos (fijo, destino de sus egresos). Varios por unidad.
  - `aprobador`: unidad requerida, único ACTIVO por unidad.
  - `responsable_almacen`: almacén requerido, único ACTIVO por almacén.
  - `central`: almacén requerido, único ACTIVO por almacén (CORREGIDO: ya no es único institucional, ahora es un central por cada almacén, mismo patrón que responsable_almacen).
  - `observador_almacen`: sin almacén fijo — usa tabla intermedia `UsuarioAlmacenObservado` (relación muchos-a-muchos, selecciona qué almacenes puede ver, para auditoría).
- **Partida** (reemplaza al concepto anterior de "Material"): catálogo oficial del Clasificador por Objeto del Gasto (Ministerio de Economía y Finanzas Públicas, Bolivia, publicado por gestión/año fiscal). NO se crea libremente en el sistema — se importa/semilla desde el documento oficial. Es **jerárquica** (auto-referenciada, hasta 5 niveles: Grupo → Subgrupo → Partida → Subpartida → Sub-subpartida), porque el clasificador real tiene profundidad variable por rama. Campos: codigo (string, ej. "39700"), denominacion, nivel (1-5, calculado por cantidad de ceros finales del código), padreId (auto-referencia), `seleccionable` (boolean — SOLO true en los nodos hoja, es decir códigos sin hijos; son los únicos que se pueden asignar a un Ítem), activo, `ultimoCorrelativo` (contador para generar códigos de Ítem, solo relevante si `seleccionable=true`). Un solo catálogo vigente, SIN versionado histórico por gestión (se actualiza in-place si el Ministerio publica cambios; poco frecuente). Alcance actual del seed: SOLO grupos `20000` (Servicios No Personales) y `30000` (Materiales y Suministros) — no se cargan otros grupos del clasificador por ahora.
- **Item**: el ítem real de almacén (catálogo compartido entre todos los almacenes). Campos: codigo (AUTOGENERADO al crear: `{partida.codigo}-{correlativo interno padStart(6)}`, ej. "39700-000001", incrementado transaccionalmente sobre `Partida.ultimoCorrelativo`), descripcion, unidadMedida, activo, `partida_id`.
- **StockAlmacen**: `item_id` + `almacen_id` + `stock_fisico` + `stock_reservado` (disponible = físico − reservado). Aquí vive el stock real, NO en Item.
- **Proveedor**: nombre, nit, teléfono, contacto.
- **Ingreso**: `almacen_id`, correlativo POR ALMACÉN, proveedor, fecha, detalle (ítem + cantidad + costo). Registrado directo por `responsable_almacen` de ESE almacén — **sin aprobación**.
- **Egreso**: `almacen_id` (heredado del solicitante), `unidad_id` (heredado del solicitante), correlativo POR ALMACÉN, estado, solicitante.
- **EgresoDetalle**: ítem, cantidad_solicitada, cantidad_aprobada (puede ajustarse en cada nivel de aprobación).
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

CREATE UNIQUE INDEX uq_central_por_almacen
ON usuarios (almacen_id)
WHERE rol = 'central' AND activo = true;
```

Complementar SIEMPRE con validación en el service (mensaje de error claro antes de que falle el índice: ej. "La unidad ya tiene un aprobador asignado"). `observador_almacen` NO lleva índice único — puede repetirse (varios observadores por almacén, varios almacenes por observador) vía la tabla `UsuarioAlmacenObservado`.

## Regla de negocio crítica: el almacén de un Egreso

El almacén destino de un Egreso es **siempre el `almacen_id` del usuario Solicitador** (fijo, no se elige manualmente al crear el egreso).

## Máquina de estados del Egreso

```
BORRADOR
   │ enviar
   ▼
PENDIENTE_APROBADOR   (aprobador de la unidad del solicitante)
   │ aprueba (puede ajustar cantidad) ──► PENDIENTE_RESPONSABLE_ALMACEN
   │ rechaza ──────────────────────────► BORRADOR
   ▼
PENDIENTE_RESPONSABLE_ALMACEN   (responsable del almacén del solicitante)
   │ aprueba (puede ajustar cantidad) ──► PENDIENTE_CENTRAL
   │    → SE RESERVA stock: stock_reservado += cantidad_aprobada
   │ rechaza ──────────────────────────► BORRADOR
   ▼
PENDIENTE_CENTRAL   (usuario con rol=central del almacén del egreso — uno por almacén)
   │ aprueba (puede ajustar cantidad final)
   │    → stock_fisico -= cantidad_final
   │    → stock_reservado -= cantidad_aprobada (libera la reserva)
   │    → genera movimiento de salida en Kardex
   │ rechaza ──────────────────────────► BORRADOR + libera la reserva
   ▼
APROBADO (ejecutado)
```

**Regla clave**: un rechazo en CUALQUIER nivel (aprobador, responsable_almacen o central) regresa el Egreso al estado `BORRADOR` (nivel 1, el solicitador), nunca al nivel anterior. El solicitador corrige y reenvía desde el inicio.

## Control de stock (Opción B — reserva progresiva)

Dos cifras por ítem y almacén: `stock_fisico` (real) y `stock_reservado` (comprometido). `stock_disponible = stock_fisico - stock_reservado`.
- La reserva se crea cuando `responsable_almacen` aprueba.
- El descuento físico definitivo ocurre solo cuando `central` aprueba.
- Cualquier rechazo posterior a la reserva debe liberarla.

## Anulación / reversión

Un Egreso `APROBADO` se puede anular:
- Marca lógica `ANULADO` (nunca se borra el registro).
- Revierte stock: `stock_fisico += cantidad_final`.
- Genera movimiento de reversión en el Kardex.
- Registra en `EgresoHistorial` quién anuló, cuándo y el motivo.

## Autenticación — sin registro público

**No existe pantalla de registro (`/register`).** Los usuarios se crean exclusivamente desde el módulo `usuarios` (por `super_admin`/`admin`), con username/password asignados ahí. El frontend solo tiene pantalla de **login** — no hay flujo de auto-registro, recuperación de cuenta por "crear cuenta nueva", ni endpoint público de `POST /auth/register`. La creación de usuarios es siempre una acción administrativa autenticada (`POST /usuarios`, protegido por rol), nunca un endpoint público.

## Roadmap de construcción actual

Fase en curso: construir todo lo que NO depende de las reglas de Ingreso/Egreso aún pendientes de validar con el encargado de almacenes (ver sección de pendientes más abajo). Orden sugerido:

```
1. Setup del monorepo + docker-compose (Postgres) — YA HECHO (cascarón del proyecto ya existe)
2. schema.prisma (Unidad, Almacen, Usuario, UsuarioAlmacenObservado, Partida, Item) + migración + seed de partidas
3. auth (JWT + guards) — solo login, sin registro público
4. usuarios (CRUD + validaciones de unicidad por rol: aprobador único por unidad, responsable_almacen y central únicos por almacén)
5. unidades (CRUD simple)
6. almacenes (CRUD simple)
7. partidas (solo lectura del árbol jerárquico + activar/desactivar; NO se crean partidas a mano, vienen del seed)
8. items (CRUD + generación automática de código {partida.codigo}-{correlativo})
9. proveedores (CRUD simple)
```

NO construir todavía: `stock` (lógica de reserva/descuento), `ingresos`, `egresos`, `kardex`, `reportes` — dependen de las reglas de negocio aún pendientes de confirmar (ver sección de pendientes).

## Alcance NO incluido (por ahora)

- Transferencias de stock entre almacenes.
- Módulo de Activos Fijos.

## Convenciones de código

- Backend: un módulo NestJS por dominio (`auth`, `usuarios`, `unidades`, `almacenes`, `catalogo`, `stock`, `proveedores`, `ingresos`, `egresos`, `kardex`, `reportes`). Ver estructura completa en `docs/estructura-backend.md`.
  - **Ubicación de los módulos**: todos los módulos de dominio viven dentro de `src/modules/<modulo>/`. `src/prisma/` es infraestructura (no es módulo de dominio) y `src/common/` guarda lo compartido (ej. `common/dto/pagination-query.dto.ts`, `common/dto/paginated-result.ts`). El cliente Prisma generado está en `src/generated/prisma/`.
  - **Instalación de dependencias**: SIEMPRE correr `pnpm add`/`pnpm remove` DENTRO de `backend/` o `frontend/` (nunca en la raíz — no hay `package.json` ni workspace raíz; instalar ahí crea artefactos sueltos y provoca resolución de módulos duplicada).
  - **Listados**: todo endpoint de listado (`GET`) devuelve paginado con la forma estándar `{ data, meta: { total, page, pageSize, totalPages } }`, usando el helper `paginated()`. El query DTO de cada módulo **extiende** `PaginationQueryDto` y agrega sus propios filtros + un buscador `q` según los campos de texto de su schema (ej. usuarios busca en `nombre`/`usuario`; unidades en `nombre`/`sigla`). Los DTO de update se definen explícitos (campos opcionales), no con `PartialType`/mapped-types, para no sumar dependencias.
  - **Booleanos en query**: usar el helper `toBoolean` de `common/dto/transforms.ts` con `@Transform`. El `ValidationPipe` global NO usa `enableImplicitConversion` (coacciona mal los booleanos: `Boolean('false') === true`); los numéricos de query llevan `@Type(() => Number)` explícito.
- Frontend: organizado por `features/` (dominio), no por tipo de archivo. Componente `EgresoAprobacion` reutilizado por los 3 roles que aprueban (aprobador, responsable_almacen, central), variando solo qué acciones habilita.
  - **Estructura híbrida por módulo**: módulos simples (≤5 archivos: unidades, almacenes, proveedores) van planos dentro de `features/<modulo>/`. Módulos complejos (egresos, ingresos, reportes) usan subcarpetas `components/`, `hooks/`, `pages/` dentro de su propia carpeta de feature. No aplicar subcarpetas a todos los módulos por igual.
- Guards de NestJS deben validar scope: `responsable_almacen` solo puede actuar sobre egresos/ingresos de SU `almacen_id`; `aprobador` solo sobre egresos de SU `unidad_id`.
- Nunca borrar registros de Ingreso/Egreso — siempre baja lógica + reversión, con historial.

## Stack de UI del frontend (confirmado)

- **shadcn/ui + react-hook-form + Zod** (NO Ant Design — descartado).
- Componentes de formulario personalizados con sufijo **`*Field`**, no prefijo `Form*` (para no chocar con la familia oficial `Form/FormField/FormItem/FormControl` de shadcn, que no se usa aquí). Todos se componen sobre los primitivos `Field`, `FieldLabel`, `FieldError` de shadcn + `Controller` de react-hook-form, con tipado genérico `<T extends FieldValues>` y `Path<T>` para el `name`.
  - Nombres ya definidos: `InputField`, `SelectField`, `TextareaField`, `DateField`, `ComboboxField`, `NumberField`.
  - `ComboboxField` es obligatorio para elegir Ítem (catálogo grande, un `<select>` normal no escala).
  - Falta construir un wrapper sobre `useFieldArray` para las líneas dinámicas de `EgresoDetalle`/`IngresoDetalle` (agregar/quitar ítems), compartido entre `EgresoForm` e `IngresoForm`.
- Validación con Zod; el schema de cada formulario debe reflejar el DTO/`class-validator` del backend correspondiente, para no duplicar reglas desalineadas entre frontend y backend.

## Pendiente de definición (esperar validación del encargado de almacenes antes de implementar)

- Reglas exactas de rechazo por nivel (¿siempre vuelve a BORRADOR o a veces un nivel atrás?).
- SLA / tiempos de espera por nivel.
- Cancelación del egreso por el propio solicitador antes de aprobación.
- Egresos que saltan niveles por monto/cantidad bajo.
- Qué pasa si al llegar a Central ya no hay stock físico suficiente.
- Reglas de anulación: quién autoriza, plazo límite, motivo obligatorio.
- Cierre de gestión anual (bloqueo de movimientos retroactivos, reinicio de correlativos).
- Reportes específicos requeridos.
- Manejo de ausencia/suplencia de aprobador o responsable_almacen.
- Confirmar si el Egreso también necesita reportar/agrupar por Partida (ej. para reportes de ejecución presupuestaria por objeto del gasto), o si la Partida solo importa a nivel de catálogo/Ingreso.
- Ancho del padding del correlativo de Ítem: se asumió 6 dígitos (`000001`), confirmar o ajustar.

Ver detalle completo de estas preguntas en `docs/preguntas-encargado-almacenes.md`.
