# Pendientes del sistema

Lista viva de lo que falta, en el orden en que conviene hacerlo. Actualizada al 2026-11-16.
El detalle de cada decisión está en `CLAUDE.md` y en `docs/decisiones-*.md`; acá va solo **qué
falta y qué lo bloquea**.

## 1. Por construir (en este orden)

### 1.1 Cierre de gestión + Cuadros 5 y 6 — SIGUIENTE
Todo decidido (2026-11-12 y 2026-11-16, detalle en `docs/decisiones-ingresos.md` §9).
**Etapa 1 (backend) HECHA el 2026-11-16**; faltan la pantalla + acta (etapa 2) y los Cuadros (etapa 3):
- Por almacén, botón, solo `super_admin`, **sin plazo**, en orden, sin reapertura, sin recuento.
- Traba: pedidos con número de la gestión sin entregar ni desistir.
- Pedidos de la gestión anterior: desde el 1/1 solo devolver o desistir.
- Gestión cerrada congelada (sin anular ni editar nada de ella).
- Foto al 31/12 + acta (PDF) + Cuadros 5 y 6 del almacén y el institucional (PDF y Excel).
- **Pendiente**: las firmas de los cuadros (las define el Ministerio).

## 2. Migración del sistema anterior (saldos iniciales)

La herramienta y la pantalla ya están (`tools/migracion-saldos/` + Administración → Saldos
iniciales). Falta el trabajo de datos:
- [ ] **Confirmar la fecha de corte**: si el sistema viejo sigue en uso hasta el 31/12, los saldos
      se migran al 31/12 con un volcado de fin de año (volver a correr `extrae-saldos.js`).
- [ ] **Armar el catálogo de ítems nuevo** (se rehace desde cero): sin códigos nuevos no hay
      correspondencia posible.
- [ ] Completar la planilla: almacén nuevo, fuente nueva y código de ítem nuevo de cada uno.
- [ ] Revisar la hoja **PARA REVISAR** (lotes con saldo negativo en el sistema viejo).
- [ ] **Confirmar con el encargado el saldo de semilla de palma OLEÍFERAS (Bs 42,3 M)**: parece
      un error de carga.
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
- Las partidas entran los 9 grupos activos; al almacén solo le sirven 20000 y 30000.
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
