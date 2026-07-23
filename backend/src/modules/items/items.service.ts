import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import {
  IMAGE_MAX_SIDE,
  IMAGE_WEBP_QUALITY,
  ITEMS_IMAGE_DIR,
  ITEMS_IMAGE_SUBDIR,
  UPLOAD_PUBLIC_PREFIX,
} from '../../common/uploads/uploads.config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

/** Ancho del correlativo en el codigo del item (ej. "39700-000001"). */
const CORRELATIVO_PADDING = 6;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea el item y autogenera su codigo `{partida.codigo}-{correlativo}`.
   * Todo ocurre en una transaccion: el `increment` sobre `ultimoCorrelativo` toma
   * un lock de fila, por lo que dos creaciones simultaneas sobre la misma partida
   * se serializan y nunca reciben el mismo correlativo.
   */
  async create(dto: CreateItemDto) {
    return this.prisma.$transaction(async (tx) => {
      const partida = await tx.partida.findUnique({
        where: { id: dto.partidaId },
        select: {
          id: true,
          codigo: true,
          activo: true,
          seleccionable: true,
          padreId: true,
        },
      });

      if (!partida) {
        throw new NotFoundException(
          `No existe la partida con id ${dto.partidaId}`,
        );
      }
      // Solo los nodos hoja del clasificador admiten items (ver CLAUDE.md).
      if (!partida.seleccionable) {
        throw new BadRequestException(
          `La partida ${partida.codigo} no es seleccionable: solo se pueden asignar items a partidas de ultimo nivel`,
        );
      }
      if (!partida.activo) {
        throw new BadRequestException(
          `La partida ${partida.codigo} esta inactiva`,
        );
      }

      // "Activo efectivo": la hoja solo es asignable si ella Y toda su cadena de
      // ancestros estan activos. Desactivar un grupo (o cualquier nodo padre)
      // inhabilita toda su rama sin tocar el estado individual de las hojas.
      let padreId = partida.padreId;
      while (padreId != null) {
        const ancestro = await tx.partida.findUnique({
          where: { id: padreId },
          select: { codigo: true, activo: true, padreId: true },
        });
        if (!ancestro) break;
        if (!ancestro.activo) {
          throw new BadRequestException(
            `La partida ${partida.codigo} pertenece a la rama de ${ancestro.codigo}, que esta inactiva`,
          );
        }
        padreId = ancestro.padreId;
      }

      const { ultimoCorrelativo } = await tx.partida.update({
        where: { id: partida.id },
        data: { ultimoCorrelativo: { increment: 1 } },
        select: { ultimoCorrelativo: true },
      });

      const codigo = `${partida.codigo}-${String(ultimoCorrelativo).padStart(
        CORRELATIVO_PADDING,
        '0',
      )}`;

      return tx.item.create({
        data: {
          codigo,
          descripcion: dto.descripcion,
          unidadMedida: dto.unidadMedida,
          activo: dto.activo ?? true,
          partidaId: partida.id,
        },
      });
    });
  }

  async findAll(query: QueryItemsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Busqueda sin acentos: se resuelve en SQL crudo y vuelve como lista de ids.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'items',
          ['codigo', 'descripcion'],
          query.q,
        )
      : null;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(query.partidaId !== undefined ? { partidaId: query.partidaId } : {}),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };

    const orderBy =
      query.orden === 'descripcion'
        ? [{ descripcion: 'asc' as const }, { id: 'asc' as const }]
        : query.orden === 'codigo'
          ? [{ codigo: 'asc' as const }, { id: 'asc' as const }]
          : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [data, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          partida: { select: { id: true, codigo: true, denominacion: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.item.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        partida: { select: { id: true, codigo: true, denominacion: true } },
      },
    });
    if (!item) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }
    return item;
  }

  /** No se puede cambiar el codigo ni la partida (ver UpdateItemDto). */
  async update(id: number, dto: UpdateItemDto) {
    const existente = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }

    await this.prisma.item.update({
      where: { id },
      data: {
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion }
          : {}),
        ...(dto.unidadMedida !== undefined
          ? { unidadMedida: dto.unidadMedida }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return this.findOne(id);
  }

  /**
   * Reemplaza la imagen referencial del item. El original subido nunca toca
   * disco crudo: se re-procesa con sharp (redimensiona sin ampliar + WebP) y
   * recien el resultado se escribe. Si ya habia imagen, se borra la anterior.
   * El nombre lleva un sufijo aleatorio para que la URL publica no sea adivinable.
   */
  async setImagen(id: number, file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibio ninguna imagen');
    }

    const item = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, imagenUrl: true },
    });
    if (!item) {
      throw new NotFoundException(`No existe el item con id ${id}`);
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

    await mkdir(ITEMS_IMAGE_DIR, { recursive: true });
    const filename = `${id}-${randomUUID().slice(0, 8)}.webp`;
    await writeFile(join(ITEMS_IMAGE_DIR, filename), procesada);

    const imagenUrl = `${UPLOAD_PUBLIC_PREFIX}/${ITEMS_IMAGE_SUBDIR}/${filename}`;
    await this.prisma.item.update({ where: { id }, data: { imagenUrl } });

    // Borra la imagen anterior despues de commitear la nueva (best-effort).
    await this.borrarArchivoImagen(item.imagenUrl);

    return this.findOne(id);
  }

  /** Quita la imagen del item (borra el archivo y limpia la ruta en la DB). */
  async removeImagen(id: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, imagenUrl: true },
    });
    if (!item) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }
    if (item.imagenUrl) {
      await this.prisma.item.update({
        where: { id },
        data: { imagenUrl: null },
      });
      await this.borrarArchivoImagen(item.imagenUrl);
    }
    return this.findOne(id);
  }

  /**
   * Borra del disco el archivo de una imagen a partir de su ruta publica.
   * Best-effort: un fallo (archivo ya inexistente) no debe romper la operacion,
   * la fuente de verdad es la DB. Solo actua dentro de ITEMS_IMAGE_DIR.
   */
  private async borrarArchivoImagen(imagenUrl: string | null) {
    if (!imagenUrl) return;
    try {
      await rm(join(ITEMS_IMAGE_DIR, basename(imagenUrl)), { force: true });
    } catch {
      // Se ignora: la ruta ya quedo desvinculada en la DB.
    }
  }

  /** Baja logica (desactiva). No se borra para preservar el historial de movimientos. */
  async remove(id: number) {
    const existente = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }
    if (existente.activo) {
      await this.prisma.item.update({ where: { id }, data: { activo: false } });
    }
    return this.findOne(id);
  }
}
