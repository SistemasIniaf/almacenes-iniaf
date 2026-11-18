import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { Prisma } from '../../generated/prisma/client';

const SIMULTANEO =
  'Otra operación tocó los mismos datos al mismo tiempo: volvé a intentarlo';

/**
 * Traduce los errores de la BASE que son culpa de la concurrencia —no un bug—
 * a un 409 con mensaje, en vez del 500 «Internal server error» (2026-11-18).
 *
 * Los services validan antes de escribir («ya existe ese usuario»), pero entre
 * la validacion y la escritura otro pedido puede ganar la carrera: ahi el que
 * frena es el indice unico de la base, y ese error llegaba crudo. Lo demas
 * sigue saliendo como 500: es lo que tiene que quedar en el log.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(this.traducir(error) ?? error, host);
  }

  private traducir(
    error: Prisma.PrismaClientKnownRequestError,
  ): HttpException | null {
    switch (error.code) {
      // Indice unico (nombre, usuario, NIT, un aprobador por unidad…).
      case 'P2002':
        return new ConflictException(
          'Ya existe un registro con esos datos: actualizá la página y revisá',
        );
      // Clave foranea: se referencia algo que ya no existe, o se borra algo en uso.
      case 'P2003':
        return new ConflictException(
          'La operación hace referencia a un registro que no existe o que está en uso',
        );
      // Conflicto de escritura o deadlock entre dos operaciones simultaneas.
      case 'P2034':
        return new ConflictException(SIMULTANEO);
      default:
        return /deadlock|40P01/i.test(error.message)
          ? new ConflictException(SIMULTANEO)
          : null;
    }
  }
}
