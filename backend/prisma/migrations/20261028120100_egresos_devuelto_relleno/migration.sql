-- Los pedidos que ya estaban rechazados pasan a DEVUELTO. Se reconocen igual que
-- los distinguia el codigo hasta hoy: pendientes de envio CON numero (el numero
-- se estampa al enviar, asi que un borrador que nunca se envio no lo tiene).
--
-- El historial NO se reescribe: los rechazos viejos quedan como
-- `... -> BORRADOR`, que es lo que paso en su momento, y la pantalla los narra
-- igual que los nuevos.
UPDATE "egresos"
SET "estado" = 'DEVUELTO'
WHERE "estado" = 'BORRADOR' AND "numero" IS NOT NULL;
