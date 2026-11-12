# Migración de saldos iniciales desde el sistema anterior

El catálogo de ítems del sistema nuevo se arma **desde cero**, así que los saldos
no se pueden pasar con un script directo: alguien tiene que decir a qué ítem
nuevo corresponde cada ítem viejo. El camino acordado (2026-11-12) es híbrido:

1. **Extraer** — `extrae-saldos.js` lee el volcado del sistema anterior y arma
   una planilla con los lotes que tienen saldo, ya llenos (cantidad, precio,
   fuente, proveedor, factura, C31…).
2. **Corresponder** — en la planilla solo se completan las columnas en
   amarillo: almacén nuevo, fuente nueva (vienen sugeridas por nombre) y código
   de ítem nuevo. Son ~1.900 ítems, no los 23.000 del catálogo viejo.
3. **Importar** — pantalla de `super_admin` en el sistema (pendiente de
   construir) que valida fila por fila y crea los saldos iniciales.

```bash
npm install
node extrae-saldos.js "C:/Users/SISTEMAS/Downloads/semilla9_al.sql" 2026 saldos-2026.xlsx
```

## Cómo calcula

- **Solo los lotes de la gestión pedida.** El cierre del sistema anterior
  duplica cada año los lotes con saldo como «Ingreso saldos» (tipo 39), así que
  los vivos son los de la última gestión.
- **El saldo se recalcula**: cantidad ingresada − cantidad *despachada*
  (`egresositems.cantidad`) de egresos **aprobados** (estado 106, o sin estado:
  los de 2015-2017, anteriores al circuito). `SALDOCANTIDAD` no se usa: está
  desincronizado.
- **Los pedidos pendientes no restan**, pero se avisan en la columna Alerta:
  hay que resolverlos en el sistema anterior antes del corte.
- **Lotes con más salidas que ingreso** van a la hoja «PARA REVISAR» y no se
  migran.

El volcado y la planilla quedan **fuera del repo** (`.gitignore`): el volcado
trae contraseñas en texto plano y la planilla, datos reales.
