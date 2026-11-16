# Pendientes del sistema

Lista viva de lo que falta, en el orden en que conviene hacerlo. Actualizada al 2026-11-16.
El detalle de cada decisión está en `CLAUDE.md` y en `docs/decisiones-*.md`; acá va solo **qué
falta y qué lo bloquea**.

## 1. Por construir (en este orden)

### 1.1 Cierre de gestión + Cuadros 5 y 6 — HECHO (2026-11-16)
Todo decidido (2026-11-12 y 2026-11-16, detalle en `docs/decisiones-ingresos.md` §9).
Las tres etapas HECHAS el 2026-11-16 (backend, pantalla `/cierres` + acta PDF, Cuadros 5 y 6 en PDF/Excel). Lo que queda abierto está al final:
- Por almacén, botón, solo `super_admin`, **sin plazo**, en orden, sin reapertura, sin recuento.
- Traba: pedidos con número de la gestión sin entregar ni desistir.
- Pedidos de la gestión anterior: desde el 1/1 solo devolver o desistir.
- Gestión cerrada congelada (sin anular ni editar nada de ella).
- Foto al 31/12 + acta (PDF) + Cuadros 5 y 6 del almacén y el institucional (PDF y Excel).
- **Pendiente**: las firmas del acta y de los cuadros (las define la institución / el Ministerio).

## 2. Migración del sistema anterior (saldos iniciales)

La herramienta y la pantalla ya están (`tools/migracion-saldos/` + Administración → Saldos
iniciales). Falta el trabajo de datos.

**Foto al 16/11/2026** (volcado `semilla9_al.sql`, planilla `saldos-2026-al-16-11.xlsx`, fuera del
repo): **3.040 lotes · 1.874 ítems · 23 almacenes viejos · 26 fuentes · 414 proveedores ·
Bs 45.279.867,81**. El 2026-11-16 se le mandó al encargado un Word con todo el detalle y 9
decisiones para responder (`Migracion-saldos-almacenes-INIAF.docx`, también fuera del repo;
lo genera un script de un solo uso, no versionado).

Esperando respuesta del encargado:
- [ ] **Lista de almacenes nuevos** y qué viejos se juntan (CNPSH SEMILLAS / CNPSH, las dos
      OLEÍFERAS, CHACO / GRAN CHACO; WARNES, PANDO y BOSQUES tienen 1–10 lotes). La base nueva
      no tiene almacenes: hay que crearlos antes de importar.
- [ ] **Quién arma el catálogo de ítems** (se rehace desde cero; sin códigos nuevos no hay
      correspondencia posible).
- [ ] **Lista de unidades de medida**: el viejo tiene 124 escrituras (PIEZA/Pieza/PZA./…); se
      propuso unificarlas por grupo.
- [ ] **10 ítems en la partida 34100**, que en el clasificador es GRUPO (no seleccionable): elegir
      hoja, normalmente 34110.
- [ ] **Proveedores**: ¿se confirma que NO se migran al catálogo (quedan en la observación)?
- [ ] **OLEÍFERAS = 93,5 % del valor** (tierra vegetal 13 M, semilla de palma 9,7 M, gallinaza
      6,1 M, bolsas 3,1 M): confirmar el saldo real; parece material ya usado o error de carga.
- [ ] **28 lotes con precio 0** (semillas): precio real o confirmar que van en cero.
- [ ] **Fecha de corte** y desde cuándo se deja de registrar en el sistema viejo.
- [ ] Fuentes genéricas «TGN» y «REC.PROPIOS»: ¿quedan así? (las 26 ya se relacionaron solas).

Antes del corte (en el sistema viejo):
- [ ] Entregar o anular los pedidos pendientes: **139 lotes** (53 de CENTRAL, 33 CNPSH SEMILLAS,
      27 CNPSH, 14 La Paz, 11 Toralapa, 1 Oruro). No se migran: el saldo saldría inflado.
- [ ] Corregir la hoja **PARA REVISAR**: 79 lotes con salidas mayores al ingreso (Bs −668.406,77),
      que no se migran.

Al crear los ítems nuevos:
- 177 descripciones vienen con acentos rotos por la codificación (`CAÃAHUA` = CAÑAHUA): escribirlas
  bien.
- 158 ítems en 76 grupos de «posible duplicado»: mismo código si es la misma unidad.
- Partida y unidad no se pueden corregir una vez que el ítem tiene movimientos: revisarlas ANTES
  de importar.

Después del corte:
- [ ] Nuevo volcado + volver a correr `extrae-saldos.js` y copiar la correspondencia ya trabajada.
- [ ] Importar almacén por almacén en el servidor y cotejar los saldos con el encargado.

## 3. Por confirmar con el encargado de almacenes

- Devoluciones de material ya retirado: ¿alcanza con anular el egreso o hace falta un documento
  propio? (el sistema viejo tenía «Ingreso devolución», sin uso desde 2021).
- Plazos por nivel de aprobación (si se quieren alertas por demora).
- Ancho del correlativo del código de ítem (se asumió 6 dígitos: `39500-000001`).
- Posición final del campo Certificación en el formulario de ingreso.

## 4. Seed (en curso, 2026-11-13)

El usuario quiere ajustar lo que carga `pnpm seed` (super_admin → 54 unidades → 40 fuentes →
505 partidas). Falta que diga qué cambiar. Puntos detectados:
- Re-correr el seed **reactiva unidades** dadas de baja (las fuentes no).
- Sin `SEED_ADMIN_PASSWORD` en el `.env`, el super_admin nace con `admin123`.
- ~~Las partidas entran los 9 grupos activos~~ — hecho 2026-11-16: solo 20000 y 30000 nacen
  activos; el super_admin pasó a llamarse `superadmin`.
- No siembra almacenes reales ni la relación almacén ↔ unidades.

Clasificador 2027 comparado contra el 2026 (2026-11-13): mismos 505 códigos y nombres; solo
6 correcciones de redacción en descripciones, que el sistema no guarda. No hay que tocar el CSV.

Base de la virtual: se decidió **vaciar el movimiento** (ítems, ingresos, egresos, traspasos,
kardex) conservando almacenes, usuarios, unidades, fuentes, partidas y proveedores. Sin hacer.

## 5. Infraestructura / servidor

- **HTTPS**: pendiente hasta tener IP pública + dominio (Let's Encrypt).
- **Copia de respaldos fuera del servidor**: hoy quedan en el mismo disco de la VM.

## 6. Riesgos aceptados (no son pendientes, pero conviene tenerlos a la vista)

- La contraseña inicial no obliga a cambiarse: una cuenta que nunca la cambió la puede usar
  quien conozca la inicial.
- Cambiar la contraseña no cierra las otras sesiones abiertas (el refresh token vale 7 días).
- Las mayúsculas automáticas son solo del frontend salvo en nombre y cargo del usuario.
