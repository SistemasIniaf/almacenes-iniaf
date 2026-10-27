-- Reserva de 48 h con reloj propio, vaciado al vencer y estado DESISTIDO
-- (2026-10-27). Escrita a mano: el relleno de `reserva_desde` no lo genera
-- Prisma.

-- Cierre de un pedido con numero que no se va a reenviar (no se puede borrar:
-- dejaria un hueco en la serie).
ALTER TYPE "EstadoEgreso" ADD VALUE 'DESISTIDO';

-- El vaciado por vencimiento lo hace el sistema, no una persona.
ALTER TABLE "egreso_historial" ALTER COLUMN "usuario_id" DROP NOT NULL;

-- Desde cuando corren las 48 h. Antes se median desde `created_at`, asi que un
-- pedido rechazado conservaba o perdia su reserva segun cuanto hubiera tardado
-- el aprobador en decidir.
ALTER TABLE "egresos" ADD COLUMN "reserva_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Relleno con la regla nueva: el ultimo momento en que el pedido quedo en manos
-- del solicitante (su alta o su ultimo rechazo, que son los pasos del historial
-- que terminan en BORRADOR). Para los ya enviados no importa —solo cuenta
-- mientras esta pendiente de envio— pero queda con un valor que tiene sentido.
UPDATE "egresos" e
SET "reserva_desde" = COALESCE(
  (
    SELECT MAX(h."created_at")
    FROM "egreso_historial" h
    WHERE h."egreso_id" = e."id" AND h."estado_nuevo" = 'BORRADOR'
  ),
  e."created_at"
);
