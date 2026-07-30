-- La linea de egreso no lleva observacion propia (decision del encargado,
-- 2026-07-30). Lo que hay para aclarar de un pedido va en la `justificacion` de
-- la cabecera, que es obligatoria. La diferencia con `ingreso_detalles` —que SI
-- la conserva— es que ahi la nota describe el material recibido ("COLOR NEGRO")
-- y se imprime pegada a la descripcion en la nota de ingreso.
ALTER TABLE "egreso_detalles" DROP COLUMN "observacion";
