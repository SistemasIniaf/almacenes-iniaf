-- Contraseña inicial generica de las cuentas nuevas (2026-10-29) y la marca de
-- "todavia tiene una contraseña que le dieron" (informativa: cambiarla no es
-- obligatorio). Las cuentas existentes quedan en false: ya tienen la suya.
ALTER TABLE "usuarios" ADD COLUMN "con_clave_inicial" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "configuracion_sistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clave_inicial" TEXT NOT NULL,
    "actualizado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "configuracion_sistema" ADD CONSTRAINT "configuracion_sistema_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La unica fila. Valor de arranque: se cambia desde la pantalla de Usuarios
-- («Contraseña inicial»), solo el super_admin.
INSERT INTO "configuracion_sistema" ("id", "clave_inicial", "updated_at") VALUES (1, 'iniaf2026', CURRENT_TIMESTAMP);
