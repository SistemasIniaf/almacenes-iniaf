# Scripts de análisis del sistema anterior

Producen las cifras de [`docs/analisis-sistema-anterior.md`](../../docs/analisis-sistema-anterior.md).
Parsean el volcado MySQL **como texto**: no hace falta levantar ninguna base.

```bash
node analiza-dump.js   "C:/Users/SISTEMAS/Desktop/backup_db/semilla9_al.sql"
node analiza-fondos.js "<ruta-al-dump.sql>"
node analiza-tipos.js  "<ruta-al-dump.sql>"
node analiza-numero.js "<ruta-al-dump.sql>"
```

| Script | Qué responde |
|---|---|
| `analiza-dump.js` | Volumen, ingresos por gestión, correlativos, tipos de documento, fuentes, salidas multi-lote, estado de `SALDOCANTIDAD` |
| `analiza-fondos.js` | Cuántos ítems se compran con más de una fuente; variación de precio del mismo ítem |
| `analiza-tipos.js` | Cómo se llena cada tipo de ingreso; las devoluciones una por una; fechas; responsables |
| `analiza-numero.js` | De dónde sale `NUMEROINGRESO` y por qué se duplica |

> El volcado **no está en el repo** (86 MB, y la tabla `personal` guarda
> contraseñas en texto plano). Está en `Desktop\backup_db\` de la máquina de
> Sistemas; para usarlo en otra PC hay que copiarlo por fuera de git.

## `genera-preguntas.js`

Genera `docs/preguntas-encargado-almacenes.docx`. Necesita la librería `docx`:

```bash
npm install docx
node genera-preguntas.js "../../docs/preguntas-encargado-almacenes.docx"
```
