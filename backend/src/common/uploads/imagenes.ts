import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

import {
  IMAGE_MAX_SIDE,
  IMAGE_WEBP_QUALITY,
  UPLOAD_PUBLIC_PREFIX,
} from './uploads.config';

/**
 * Procesado y escritura de las imagenes subidas, compartido por los dos lugares
 * que las aceptan: la foto de CATALOGO del Item y la del LOTE (IngresoDetalle).
 *
 * Vive aca y no en un service porque el pipeline tiene que ser identico en los
 * dos: si el tamano o la calidad se tocan en un solo lado, dos fotos que el
 * usuario ve una al lado de la otra —la del item y la del lote que la pisa—
 * saldrian con distinto peso y nitidez.
 */

/**
 * Re-procesa la imagen subida y la escribe en disco. El original NUNCA toca el
 * disco crudo: se redimensiona (sin ampliar) y se convierte a WebP en memoria, y
 * recien el resultado se guarda.
 *
 * Devuelve la ruta PUBLICA relativa, que es lo unico que se guarda en la DB.
 * El nombre lleva un sufijo aleatorio porque las estaticas se sirven fuera del
 * guard: sin el, la URL de cualquier foto seria adivinable a partir del id.
 */
export async function guardarImagen(
  file: Express.Multer.File,
  destino: { dir: string; subdir: string; nombreBase: number | string },
): Promise<string> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('No se recibio ninguna imagen');
  }

  let procesada: Buffer;
  try {
    procesada = await sharp(file.buffer)
      .rotate() // respeta la orientacion EXIF antes de descartar metadatos
      .resize(IMAGE_MAX_SIDE, IMAGE_MAX_SIDE, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'El archivo no es una imagen valida o esta corrupto',
    );
  }

  await mkdir(destino.dir, { recursive: true });
  const filename = `${destino.nombreBase}-${randomUUID().slice(0, 8)}.webp`;
  await writeFile(join(destino.dir, filename), procesada);

  return `${UPLOAD_PUBLIC_PREFIX}/${destino.subdir}/${filename}`;
}

/**
 * Borra del disco el archivo de una imagen a partir de su ruta publica.
 *
 * Best-effort a proposito: la fuente de verdad es la DB, asi que un archivo que
 * ya no esta no debe hacer fallar la operacion que lo desvinculo. Solo actua
 * dentro de `dir` — se queda con el `basename` de la ruta, nunca con la ruta
 * entera, para que un valor raro en la DB no pueda apuntar a otra carpeta.
 */
export async function borrarImagen(dir: string, imagenUrl: string | null) {
  if (!imagenUrl) return;
  try {
    await rm(join(dir, basename(imagenUrl)), { force: true });
  } catch {
    // Se ignora: la ruta ya quedo desvinculada en la DB.
  }
}
