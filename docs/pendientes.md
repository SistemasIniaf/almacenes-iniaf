# Pendientes del sistema

Lista viva de lo que falta, en el orden en que conviene hacerlo. Actualizada al 2026-11-13.
El detalle de cada decisión está en `CLAUDE.md` y en `docs/decisiones-*.md`; acá va solo **qué
falta y qué lo bloquea**.

## 1. Por construir (en este orden)

### 1.1 Ajuste de inventario (recuento físico) — SIGUIENTE
Va **antes** del cierre: el recuento físico de fin de año tiene que poder corregir el saldo de
los lotes antes de sacar la foto al 31/12.
- Documento propio por almacén, con número, motivo y quién lo hizo.
- Por lote: saldo del sistema → cantidad contada → diferencia (sobrante / faltante).
- Movimiento de kardex propio (no un egreso ni un ingreso), valorizado al precio del lote.
- **Por definir con el encargado**: quién lo registra (¿super_admin? ¿responsable de almacén
  con aprobación?), si un sobrante crea lote nuevo o suma al existente, si se puede anular, y
  qué acta / PDF se firma.

### 1.2 Cierre de gestión
Decidido el 2026-11-12, falta construirlo:
- **Por almacén**, con un botón, **solo `super_admin`**.
- Se hace en las **dos primeras semanas de enero** (sobre la gestión que terminó).
- **Sin reapertura**: una gestión cerrada no se vuelve a abrir.
- Foto de saldos por lote al 31/12 (la apertura de la gestión siguiente) + **acta en PDF**.
- Requisitos previos que el botón tiene que verificar: sin pedidos sin cerrar, recuento hecho.
- Después del cierre: **bloquear todo movimiento con fecha de la gestión cerrada** (ingresos,
  entregas, anulaciones, corrección de `fechaIngreso`, traspasos, ajustes).
- Para probarlo antes de enero: un modo de prueba solo en desarrollo que permita cerrar la
  gestión en curso.

### 1.3 Cuadros 5 y 6 DGCF (anexos de Estados Financieros)
Dependen del cierre y de los saldos iniciales. Tres puntos a definir con contabilidad antes de
construirlos:
- «Precio unitario» del Cuadro 6: ¿una fila por ítem+precio, promedio ponderado o último precio?
- ¿A qué nivel del clasificador agrupa la «Partida» del Cuadro 5?
- Salen en PDF y Excel (contabilidad los pega en la plantilla oficial).

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
- [ ] Importar almacén por almacén en el servidor y cotejar contra el recuento físico.

## 3. Por confirmar con el encargado de almacenes

- Ajuste de inventario: las preguntas del punto 1.1.
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
