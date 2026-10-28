-- Estado DEVUELTO (2026-10-28): el pedido rechazado ya no vuelve a BORRADOR.
--
-- Va SOLO en esta migracion: Postgres no deja usar un valor de enum en la misma
-- transaccion que lo agrega ("unsafe use of new value"), asi que el relleno de
-- los pedidos ya rechazados va en la migracion siguiente.
ALTER TYPE "EstadoEgreso" ADD VALUE 'DEVUELTO' AFTER 'BORRADOR';
