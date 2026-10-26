-- La reserva de 48 h de un BORRADOR se contaba desde `created_at`, asi que un
-- pedido RECHAZADO (que vuelve a borrador) creado hace mas de 48 h perdia la
-- reserva en el mismo instante del rechazo: mientras el solicitante lo
-- corregia, otro pedido podia llevarse ese saldo.
--
-- Ahora la ventana corre desde `reserva_desde`, que se estampa al crear y se
-- reinicia al rechazar. Los egresos existentes arrancan con su `created_at`,
-- que es exactamente lo que valia hasta hoy: nadie gana ni pierde reserva por
-- aplicar esta migracion.
ALTER TABLE "egresos" ADD COLUMN "reserva_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "egresos" SET "reserva_desde" = "created_at";
