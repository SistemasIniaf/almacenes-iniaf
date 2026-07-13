import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  AuthenticatedUser,
  JwtRefreshPayload,
} from '../interfaces/jwt-payload.interface';

/** Valida el refresh token (secreto distinto) para emitir un nuevo access token. */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET') as string,
      passReqToCallback: true,
    });
  }

  async validate(
    _req: Request,
    payload: JwtRefreshPayload,
  ): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        usuario: true,
        rol: true,
        activo: true,
        unidadId: true,
        almacenId: true,
      },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario inexistente o inactivo');
    }

    return {
      id: usuario.id,
      usuario: usuario.usuario,
      rol: usuario.rol,
      unidadId: usuario.unidadId,
      almacenId: usuario.almacenId,
    };
  }
}
