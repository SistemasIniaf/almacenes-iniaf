import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

/** Valida el access token y carga el usuario vigente en `request.user`. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Se revalida contra la BD: un usuario desactivado no debe seguir operando
    // aunque su token siga vigente.
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
