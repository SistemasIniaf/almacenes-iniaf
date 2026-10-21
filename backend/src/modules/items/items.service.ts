import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { borrarImagen, guardarImagen } from '../../common/uploads/imagenes';
import {
  ITEMS_IMAGE_DIR,
  ITEMS_IMAGE_SUBDIR,
} from '../../common/uploads/uploads.config';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

/** Ancho del correlativo en el codigo del item (ej. "39700-000001"). */
const CORRELATIVO_PADDING = 6;

/**
 * Lo que se trae del item en el listado y el detalle. El `_count` de lotes es
 * lo que decide si el item ya se USO (ver `tieneMovimientos`).
 */
const itemInclude = {
  partida: { select: { id: true, codigo: true, denominacion: true } },
  _count: { select: { ingresoDetalles: true } },
} satisfies Prisma.ItemInclude;

type ItemConConteo = Prisma.ItemGetPayload<{ include: typeof itemInclude }>;

/**
 * `tieneMovimientos`: el item figura en algun ingreso (lote), anulado o no.
 * Mientras no, nada lo referencia y se le puede corregir la partida (con codigo
 * nuevo) y la unidad de medida. Despues, cambiarlas reescribiria la historia:
 * el kardex y los reportes leerian lo ya registrado en otra partida o en otra
 * unidad. Los egresos apuntan a lotes, asi que tambien quedan cubiertos.
 */
function conMovimientos({ _count, ...item }: ItemConConteo) {
  return { ...item, tieneMovimientos: _count.ingresoDetalles > 0 };
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea el item y autogenera su codigo `{partida.codigo}-{correlativo}`, en
   * una transaccion (ver `asignarCodigo`).
   */
  async create(dto: CreateItemDto) {
    const creado = await this.prisma.$transaction(async (tx) => {
      const codigo = await this.asignarCodigo(tx, dto.partidaId);

      return tx.item.create({
        data: {
          codigo,
          descripcion: dto.descripcion,
          unidadMedida: dto.unidadMedida,
          activo: dto.activo ?? true,
          partidaId: dto.partidaId,
        },
        select: { id: true },
      });
    });

    // Misma forma que el detalle (con partida y `tieneMovimientos`): si la
    // imagen falla, el formulario pasa a editar este item con lo que vuelve acá.
    return this.findOne(creado.id);
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
        include: itemInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.item.count({ where }),
    ]);

    return paginated(data.map(conMovimientos), total, page, pageSize);
  }

  async findOne(id: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: itemInclude,
    });
    if (!item) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }
    return conMovimientos(item);
  }

  /**
   * La descripcion y el estado se editan siempre. La PARTIDA y la UNIDAD DE
   * MEDIDA, solo mientras el item no tenga movimientos (ver `conMovimientos`):
   * es para corregir un error de alta, que casi siempre se nota antes de usarlo.
   *
   * Cambiar la partida le da un CODIGO NUEVO en la partida destino —el codigo
   * deriva de ella—. El correlativo que tenia en la anterior queda sin usar: un
   * salto en la numeracion, que es preferible a reusarlo.
   */
  async update(id: number, dto: UpdateItemDto) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id },
        select: {
          partidaId: true,
          unidadMedida: true,
          _count: { select: { ingresoDetalles: true } },
        },
      });
      if (!item) {
        throw new NotFoundException(`No existe el item con id ${id}`);
      }

      // La partida destino, solo si de verdad cambia (reenviar la misma no cuenta).
      const nuevaPartidaId =
        dto.partidaId !== undefined && dto.partidaId !== item.partidaId
          ? dto.partidaId
          : null;
      const cambiaPartida = nuevaPartidaId !== null;
      const cambiaUnidad =
        dto.unidadMedida !== undefined &&
        dto.unidadMedida.trim() !== item.unidadMedida;

      if ((cambiaPartida || cambiaUnidad) && item._count.ingresoDetalles > 0) {
        const campo = cambiaPartida ? 'la partida' : 'la unidad de medida';
        throw new ConflictException(
          `No se puede cambiar ${campo}: el item ya figura en ingresos registrados y se alteraria lo ya registrado. Si fue un error, anula esos ingresos, da de baja el item y crealo de nuevo.`,
        );
      }

      await tx.item.update({
        where: { id },
        data: {
          ...(nuevaPartidaId !== null
            ? {
                partidaId: nuevaPartidaId,
                codigo: await this.asignarCodigo(tx, nuevaPartidaId),
              }
            : {}),
          ...(dto.descripcion !== undefined
            ? { descripcion: dto.descripcion }
            : {}),
          ...(cambiaUnidad ? { unidadMedida: dto.unidadMedida } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        },
      });
    });

    return this.findOne(id);
  }

  /**
   * Valida que la partida admita items y devuelve el codigo siguiente en ella
   * (`{partida.codigo}-{correlativo}`). Lo usan el alta y el cambio de partida.
   *
   * Va dentro de la transaccion de quien llama: el `increment` sobre
   * `ultimoCorrelativo` toma un lock de fila, por lo que dos altas simultaneas
   * sobre la misma partida se serializan y nunca reciben el mismo correlativo.
   */
  private async asignarCodigo(
    tx: Prisma.TransactionClient,
    partidaId: number,
  ): Promise<string> {
    const partida = await tx.partida.findUnique({
      where: { id: partidaId },
      select: {
        id: true,
        codigo: true,
        activo: true,
        seleccionable: true,
        padreId: true,
      },
    });

    if (!partida) {
      throw new NotFoundException(`No existe la partida con id ${partidaId}`);
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

    return `${partida.codigo}-${String(ultimoCorrelativo).padStart(
      CORRELATIVO_PADDING,
      '0',
    )}`;
  }

  /**
   * Reemplaza la imagen referencial del item. El original subido nunca toca
   * disco crudo: se re-procesa con sharp (redimensiona sin ampliar + WebP) y
   * recien el resultado se escribe. Si ya habia imagen, se borra la anterior.
   * El nombre lleva un sufijo aleatorio para que la URL publica no sea adivinable.
   */
  async setImagen(id: number, file: Express.Multer.File) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, imagenUrl: true },
    });
    if (!item) {
      throw new NotFoundException(`No existe el item con id ${id}`);
    }

    const imagenUrl = await guardarImagen(file, {
      dir: ITEMS_IMAGE_DIR,
      subdir: ITEMS_IMAGE_SUBDIR,
      nombreBase: id,
    });
    await this.prisma.item.update({ where: { id }, data: { imagenUrl } });

    // Borra la imagen anterior despues de commitear la nueva (best-effort).
    await borrarImagen(ITEMS_IMAGE_DIR, item.imagenUrl);

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
      await borrarImagen(ITEMS_IMAGE_DIR, item.imagenUrl);
    }
    return this.findOne(id);
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
