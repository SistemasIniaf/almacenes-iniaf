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
- **Item**: el ítem real de almacén (catálogo compartido entre todos los almacenes). Campos: codigo (AUTOGENERADO al crear: `{partida.codigo}-{correlativo interno padStart(6)}`, ej. "39700-000001", incrementado transaccionalmente sobre `Partida.ultimoCorrelativo`), descripcion, unidadMedida, `imagenUrl` (String?, nullable), activo, `partida_id`.
- **StockAlmacen**: `item_id` + `almacen_id` + `stock_fisico` + `stock_reservado` (disponible = físico − reservado). Aquí vive el stock real, NO en Item.
- **Proveedor**: nombre (requerido, NO único — la razón social se escribe de formas distintas), `nit` (opcional pero `@unique`; Postgres admite varios NULL en un índice único, así que conviven proveedores sin NIT), telefono, `contacto` (nombre de la persona de contacto), direccion, activo. Baja lógica siempre: será referenciado por Ingreso y no se puede borrar sin romper el Kardex. Escritura para `super_admin` y `admin`; lectura además para `responsable_almacen` (necesita el selector de proveedor al registrar un Ingreso).
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

## Imágenes de Ítems (subida de archivos)

Cada `Item` puede tener **UNA imagen referencial** (foto de catálogo). Decisiones tomadas (confirmadas con el usuario):

- **Cardinalidad**: 1 imagen por ítem (campo `imagenUrl String?` en `Item`, NO tabla `ItemImagen`). Si en el futuro se necesitan varias, migrar a tabla 1-a-N es barato; no se sobre-construye ahora.
- **Almacenamiento**: **filesystem**, NO en la DB. El binario vive en `backend/uploads/items/` (en `.gitignore`); la DB guarda solo la ruta pública relativa (ej. `/uploads/items/3-8eeae5d8.webp`). El nombre lleva un sufijo aleatorio (`{itemId}-{uuid8}.webp`) para que la URL no sea adivinable.
- **Procesamiento**: la imagen subida NUNCA toca disco cruda. Se re-procesa con **`sharp`** (redimensiona a máx. `1024px` lado mayor sin ampliar + convierte a **WebP** calidad 80) y recién el resultado se escribe. Límites: máx. 5 MB de entrada, MIME permitidos `image/jpeg|png|webp`.
- **Servido**: **estáticas públicas** bajo `/uploads` vía `app.useStaticAssets` en `main.ts`. Quedan **FUERA** del prefijo global de la API y del `JwtAuthGuard` global — decisión deliberada para poder usarlas con `<img src>` directo. Trade-off aceptado: son adivinables solo por fuerza bruta (mitigado por el sufijo aleatorio); son fotos referenciales no sensibles.
- **Endpoints** (solo `super_admin`/`admin`): `POST /items/:id/imagen` (campo multipart `imagen`; reemplaza y borra la anterior del disco) y `DELETE /items/:id/imagen` (limpia archivo + pone `imagenUrl=null`). El CRUD normal (`PATCH`) NO toca la imagen.
- **Config central**: constantes y opciones de Multer en `src/common/uploads/uploads.config.ts` (compartidas entre el service de items y `main.ts`).
- **Pendiente frontend**: falta el componente `ImageField` (subida con preview) para cuando se arme la feature de ítems en el front — ver convención de sufijo `*Field` más abajo.
- **Pendiente despliegue**: en `docker-compose.prod.yml`, montar `uploads/` como **volumen** para que las imágenes sobrevivan a reconstrucciones del contenedor.

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
  `PublicOnlyRoute` (el login no se ve con sesión abierta).

Nota: `GET /auth/me` devuelve el contenido del token y NO incluye `nombre` (solo llega en el
login), por eso el usuario se cachea en `localStorage` — la fuente de verdad sigue siendo
`/auth/me`, del cache solo se conserva `nombre`. Si algún día se agrega `nombre` a
`AuthenticatedUser` en el backend, ese cache (`auth-storage.ts`) se puede borrar.

**Piezas compartidas ya construidas** (reutilizarlas en cada CRUD nuevo, no reinventarlas):
- `features/auth/lib/permisos.ts`: mapa `PERMISOS` que **espeja los `@Roles(...)` de cada
  controlador** + helper `tienePermiso(user, permiso)`. La UI solo OCULTA; quien autoriza es el
  backend. Si cambia un `@Roles` allá, hay que actualizar este archivo.
- `components/data/DataPagination.tsx`: pie de paginación de los listados (no usa
  `ui/pagination` de shadcn porque ese renderiza `<a href>` y la página es estado local). Trae
  selector de **filas por página** (10/20/30/50) y **números de página con elipsis** (siempre
  primera + última + ventana alrededor de la actual). El estado (página + tamaño) lo maneja el
  hook `hooks/use-pagination.ts`, compartido por los 5 listados: cambiar el tamaño o cualquier
  filtro reinicia a la página 1 (`resetPage`), porque los índices anteriores dejan de valer. El
  tamaño inicial es **`PAGE_SIZE` de `lib/types.ts` (10)**. El backend sigue con `pageSize=20`
  por defecto para quien consuma la API directo; el frontend siempre lo manda explícito.
- `hooks/use-debounced-value.ts`: para los buscadores (no una petición por tecla).
- `components/ui/sonner.tsx` + `<Toaster>` en `main.tsx` para feedback de mutaciones. OJO: el
  generador de shadcn lo trae importando `useTheme` de `next-themes`; se reconectó al
  `ThemeProvider` propio y se desinstaló `next-themes`. Si se regenera, revisar ese import.

**Módulo `unidades` — YA HECHO** (plantilla a copiar para el resto): `unidades.types.ts`,
`unidades.schema.ts` (zod espejo del DTO), `unidades.api.ts`, `useUnidades.ts` (queries +
mutations con toast e invalidación), `UnidadFormDialog.tsx` (crear/editar en un solo diálogo),
`UnidadesPage.tsx` (buscador + filtro de estado + tabla + baja lógica con confirmación).
Detalle de permisos: unidades es el único módulo donde `admin` **lee pero no escribe**, así que
la página oculta el botón "Nueva unidad" y la columna de acciones para ese rol.

**Módulos de frontend ya hechos**: `unidades`, `almacenes`, `usuarios`. Los tres siguen la misma
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
- Desactivar **no** cascadea a los hijos (así funciona el service); el diálogo de confirmación lo
  dice explícitamente cuando el nodo tiene hijos.

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

NO construir todavía: `stock` (lógica de reserva/descuento), `ingresos`, `egresos`, `kardex`, `reportes` — dependen de las reglas de negocio aún pendientes de confirmar (ver sección de pendientes).

## Alcance NO incluido (por ahora)

- Transferencias de stock entre almacenes.
- Módulo de Activos Fijos.

## Convenciones de código

- Backend: un módulo NestJS por dominio (`auth`, `usuarios`, `unidades`, `almacenes`, `catalogo`, `stock`, `proveedores`, `ingresos`, `egresos`, `kardex`, `reportes`). Ver estructura completa en `docs/estructura-backend.md`.
  - **Ubicación de los módulos**: todos los módulos de dominio viven dentro de `src/modules/<modulo>/`. `src/prisma/` es infraestructura (no es módulo de dominio) y `src/common/` guarda lo compartido (ej. `common/dto/pagination-query.dto.ts`, `common/dto/paginated-result.ts`). El cliente Prisma generado está en `src/generated/prisma/`.
  - **Instalación de dependencias**: SIEMPRE correr `pnpm add`/`pnpm remove` DENTRO de `backend/` o `frontend/` (nunca en la raíz — no hay `package.json` ni workspace raíz; instalar ahí crea artefactos sueltos y provoca resolución de módulos duplicada).
  - **Listados**: todo endpoint de listado (`GET`) devuelve paginado con la forma estándar `{ data, meta: { total, page, pageSize, totalPages } }`, usando el helper `paginated()`. **Orden: `[{ createdAt: 'desc' }, { id: 'desc' }]`** — lo más reciente primero. El desempate por `id` no es decorativo: varios registros pueden compartir `createdAt` (el seed inserta muchos en el mismo instante) y sin él la paginación puede repetir u omitir filas entre páginas. **Excepción: `partidas`**, que se ordena por `codigo asc` porque el código ES la jerarquía del clasificador. El query DTO de cada módulo **extiende** `PaginationQueryDto` y agrega sus propios filtros + un buscador `q` según los campos de texto de su schema (ej. usuarios busca en `nombre`/`usuario`; unidades en `nombre`/`sigla`). Los DTO de update se definen explícitos (campos opcionales), no con `PartialType`/mapped-types, para no sumar dependencias.
  - **Buscador `q` (insensible a acentos)**: NO usar `contains` + `mode: 'insensitive'` de Prisma — eso ignora mayúsculas pero NO tildes, así que buscar "almacen" no encontraba "Almacén" (nadie escribe acentos al buscar). Todos los listados usan el helper `buscarIdsPorTexto()` de `common/search/busqueda-texto.ts`, que resuelve el filtro de texto con SQL crudo (`f_unaccent(col) ILIKE f_unaccent($1)`) y devuelve ids; el service los aplica como `id: { in: ids }` y conserva el resto de su lógica Prisma (filtros, orden, paginación, includes). Un array vacío significa "ninguna coincidencia", no "sin filtro". Apoyo en DB: extensiones `unaccent` + `pg_trgm`, función IMMUTABLE `f_unaccent` e índices GIN de trigramas, todo en la migración `20260719161128_busqueda_sin_acentos` (escrita a mano; Prisma no expresa `unaccent` en su DSL). **Al agregar un buscador a un módulo nuevo hay que crear también su índice GIN en una migración**, si no la búsqueda funciona pero hace scan secuencial.
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
