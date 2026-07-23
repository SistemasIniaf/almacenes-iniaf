import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { paginated } from '../../common/dto/paginated-result';
import { buscarIdsPorTexto } from '../../common/search/busqueda-texto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { QueryProveedoresDto } from './dto/query-proveedores.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';

/** Convierte cadena vacia o solo espacios en null; recorta el resto. */
function normalizar(valor?: string): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProveedorDto) {
    const nit = normalizar(dto.nit) ?? null;
    await this.validarNitUnico(nit);

    return this.prisma.proveedor.create({
      data: {
        nombre: dto.nombre.trim(),
        nit,
        telefono: normalizar(dto.telefono) ?? null,
        contacto: normalizar(dto.contacto) ?? null,
        direccion: normalizar(dto.direccion) ?? null,
        activo: dto.activo ?? true,
      },
    });
  }

  async findAll(query: QueryProveedoresDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Busqueda sin acentos: se resuelve en SQL crudo y vuelve como lista de ids.
    const idsBusqueda = query.q
      ? await buscarIdsPorTexto(
          this.prisma,
          'proveedores',
          ['nombre', 'nit', 'contacto'],
          query.q,
        )
      : null;

    const where = {
      ...(query.activo !== undefined ? { activo: query.activo } : {}),
      ...(idsBusqueda ? { id: { in: idsBusqueda } } : {}),
    };

    const orderBy =
      query.orden === 'nombre'
        ? [{ nombre: 'asc' as const }, { id: 'asc' as const }]
        : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [data, total] = await Promise.all([
      this.prisma.proveedor.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.proveedor.count({ where }),
    ]);

    return paginated(data, total, page, pageSize);
  }

  async findOne(id: number) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!proveedor) {
      throw new NotFoundException(`No existe el proveedor con id ${id}`);
    }
    return proveedor;
  }

  async update(id: number, dto: UpdateProveedorDto) {
    const existente = await this.prisma.proveedor.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException(`No existe el proveedor con id ${id}`);
    }

    const nit = normalizar(dto.nit);
    if (nit !== undefined && nit !== existente.nit) {
      await this.validarNitUnico(nit, id);
    }

    return this.prisma.proveedor.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
        ...(nit !== undefined ? { nit } : {}),
        ...(dto.telefono !== undefined
          ? { telefono: normalizar(dto.telefono) }
          : {}),
        ...(dto.contacto !== undefined
          ? { contacto: normalizar(dto.contacto) }
          : {}),
        ...(dto.direccion !== undefined
          ? { direccion: normalizar(dto.direccion) }
          : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  /** Baja logica (desactiva). No se borra para preservar la referencia de ingresos. */
  async remove(id: number) {
    const existente = await this.prisma.proveedor.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existente) {
      throw new NotFoundException(`No existe el proveedor con id ${id}`);
    }
    if (existente.activo) {
      await this.prisma.proveedor.update({
        where: { id },
        data: { activo: false },
      });
    }
    return this.findOne(id);
  }

  /**
   * Valida que el NIT no este repetido (excluyendo el propio id en updates).
   * null no compite por unicidad: puede haber varios proveedores sin NIT.
   */
  private async validarNitUnico(nit: string | null, excluirId?: number) {
    if (nit === null) return;

    const existe = await this.prisma.proveedor.findFirst({
      where: { nit, ...(excluirId ? { id: { not: excluirId } } : {}) },
      select: { id: true, nombre: true },
    });
    if (existe) {
      throw new ConflictException(
        `El NIT "${nit}" ya esta registrado en el proveedor "${existe.nombre}"`,
      );
    }
  }
}
