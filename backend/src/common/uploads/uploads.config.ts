import { join } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Configuracion central del almacenamiento de archivos en filesystem.
 *
 * Decision (ver CLAUDE.md / conversacion): las imagenes se guardan en disco,
 * NO en la DB (que solo guarda la ruta publica relativa), y se sirven como
 * estaticas publicas bajo `/uploads` (fuera del JwtAuthGuard global). Por eso
 * el nombre del archivo lleva un sufijo aleatorio: hace la URL no adivinable.
 */

/** Raiz de uploads en disco. Se monta como volumen en produccion (docker-compose.prod). */
export const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/** Prefijo publico con el que `main.ts` expone `UPLOAD_ROOT` via useStaticAssets. */
export const UPLOAD_PUBLIC_PREFIX = '/uploads';

/** Subcarpeta de las imagenes de items: <UPLOAD_ROOT>/items. */
export const ITEMS_IMAGE_SUBDIR = 'items';
export const ITEMS_IMAGE_DIR = join(UPLOAD_ROOT, ITEMS_IMAGE_SUBDIR);

/**
 * Subcarpeta de los logos institucionales: <UPLOAD_ROOT>/logos. Cae dentro del
 * mismo volumen de produccion que la de items (se monta la raiz).
 */
export const LOGOS_IMAGE_SUBDIR = 'logos';
export const LOGOS_IMAGE_DIR = join(UPLOAD_ROOT, LOGOS_IMAGE_SUBDIR);

/**
 * Lado maximo (px) de un logo. Alcanza con holgura para el uso mas exigente
 * —el membrete del PDF, ~100 pt de ancho a 300 dpi son ~420 px— y no infla
 * cada PDF y Excel, que embeben el logo entero.
 */
export const LOGO_MAX_SIDE = 800;

/** Tamano maximo del archivo subido (antes de procesar). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** MIME types aceptados en la subida. La salida siempre se normaliza a WebP. */
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Lado maximo (px) al que se redimensiona la imagen procesada (sin ampliar). */
export const IMAGE_MAX_SIDE = 1024;

/** Calidad WebP de salida (0-100). */
export const IMAGE_WEBP_QUALITY = 80;

/**
 * Opciones de Multer para la subida de imagenes de item. Usa memoria (buffer)
 * porque el archivo se re-procesa con sharp antes de tocar disco; nunca se
 * escribe el original crudo.
 */
export const imageUploadMulterOptions = {
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (
    _req: Request,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
      cb(
        new BadRequestException(
          `Formato no permitido (${file.mimetype}). Use JPEG, PNG o WebP.`,
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
