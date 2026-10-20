import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { LogoClave } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  LOGOS_IMAGE_DIR,
  LOGOS_IMAGE_SUBDIR,
} from '../../common/uploads/uploads.config';
import { borrarImagen, guardarLogo } from '../../common/uploads/imagenes';

/** Un casillero: la ruta del logo vigente, o `null` si rige el original. */
export interface LogoVigente {
  url: string | null;
  actualizadoEn: Date | null;
  actualizadoPor: string | null;
}

export type LogosVigentes = Record<LogoClave, LogoVigente>;

export interface LogoVersionDto {
  id: number;
  clave: LogoClave;
  url: string;
  subidoEn: Date;
  subidoPor: string | null;
  vigente: boolean;
}

@Injectable()
export class LogosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Siempre devuelve los TRES casilleros, aunque no haya ninguno reemplazado. */
  async findAll(): Promise<LogosVigentes> {
    const filas = await this.prisma.logoInstitucional.findMany({
      select: {
        clave: true,
        updatedAt: true,
        version: { select: { url: true } },
        actualizadoPor: { select: { nombre: true } },
      },
    });

    const vigentes = {} as LogosVigentes;
    for (const clave of Object.values(LogoClave)) {
      const fila = filas.find((f) => f.clave === clave);
      vigentes[clave] = {
        url: fila?.version.url ?? null,
        actualizadoEn: fila?.updatedAt ?? null,
        actualizadoPor: fila?.actualizadoPor?.nombre ?? null,
      };
    }
    return vigentes;
  }

  /** Todas las versiones subidas, de la más nueva a la más vieja. */
  async historial(): Promise<LogoVersionDto[]> {
    const versiones = await this.prisma.logoVersion.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        clave: true,
        url: true,
        createdAt: true,
        subidoPor: { select: { nombre: true } },
        vigenteEn: { select: { clave: true } },
      },
    });
    return versiones.map((v) => ({
      id: v.id,
      clave: v.clave,
      url: v.url,
      subidoEn: v.createdAt,
      subidoPor: v.subidoPor?.nombre ?? null,
      vigente: v.vigenteEn !== null,
    }));
  }

  /**
   * Sube un logo nuevo: queda como VERSION en el historial y pasa a regir. El
   * anterior NO se borra — sigue en el historial para poder volver a él.
   */
  async reemplazar(
    clave: LogoClave,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<LogosVigentes> {
    const url = await guardarLogo(file, {
      dir: LOGOS_IMAGE_DIR,
      subdir: LOGOS_IMAGE_SUBDIR,
      nombreBase: clave,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        const version = await tx.logoVersion.create({
          data: { clave, url, subidoPorId: user.id },
          select: { id: true },
        });
        await tx.logoInstitucional.upsert({
          where: { clave },
          create: { clave, versionId: version.id, actualizadoPorId: user.id },
          update: { versionId: version.id, actualizadoPorId: user.id },
        });
      });
    } catch (error) {
      // El archivo ya se escribió: sin la fila que lo referencia quedaría
      // huérfano en disco.
      await borrarImagen(LOGOS_IMAGE_DIR, url);
      throw error;
    }

    return this.findAll();
  }

  /** Vuelve a poner vigente una versión del historial. */
  async usarVersion(
    id: number,
    user: AuthenticatedUser,
  ): Promise<LogosVigentes> {
    const version = await this.buscarVersion(id);
    await this.prisma.logoInstitucional.upsert({
      where: { clave: version.clave },
      create: {
        clave: version.clave,
        versionId: id,
        actualizadoPorId: user.id,
      },
      update: { versionId: id, actualizadoPorId: user.id },
    });
    return this.findAll();
  }

  /**
   * Vuelve al logo original de la aplicación. Solo deja de regir la versión
   * subida: el historial queda entero.
   */
  async restaurar(clave: LogoClave): Promise<LogosVigentes> {
    await this.prisma.logoInstitucional.deleteMany({ where: { clave } });
    return this.findAll();
  }

  /**
   * Borra una versión del historial, archivo incluido. Es lo ÚNICO que borra
   * un logo del disco, y no se permite sobre la vigente: dejaría el casillero
   * apuntando a nada.
   */
  async eliminarVersion(id: number): Promise<LogoVersionDto[]> {
    const version = await this.buscarVersion(id);
    const vigente = await this.prisma.logoInstitucional.findUnique({
      where: { versionId: id },
      select: { clave: true },
    });
    if (vigente) {
      throw new ConflictException(
        'Es el logo en uso. Para eliminarlo, primero usá otro o restaurá el original.',
      );
    }

    await this.prisma.logoVersion.delete({ where: { id } });
    await borrarImagen(LOGOS_IMAGE_DIR, version.url);
    return this.historial();
  }

  private async buscarVersion(id: number) {
    const version = await this.prisma.logoVersion.findUnique({
      where: { id },
      select: { clave: true, url: true },
    });
    if (!version) {
      throw new NotFoundException(`No existe la versión de logo ${id}`);
    }
    return version;
  }
}
