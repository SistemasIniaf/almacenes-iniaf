import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import {
  AuthenticatedUser,
  JwtPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';

export interface TokensRespuesta {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRespuesta extends TokensRespuesta {
  user: AuthenticatedUser & { nombre: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Valida credenciales y emite access + refresh token. */
  async login(dto: LoginDto): Promise<LoginRespuesta> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { usuario: dto.usuario },
    });

    // Mensaje generico para no revelar si el usuario existe.
    const credencialesInvalidas = new UnauthorizedException(
      'Usuario o contrasena incorrectos',
    );

    if (!usuario || !usuario.activo) throw credencialesInvalidas;

    const passwordOk = await bcrypt.compare(dto.password, usuario.password);
    if (!passwordOk) throw credencialesInvalidas;

    const tokens = await this.generarTokens({
      id: usuario.id,
      usuario: usuario.usuario,
      rol: usuario.rol,
      unidadId: usuario.unidadId,
      almacenId: usuario.almacenId,
    });

    return {
      ...tokens,
      user: {
        id: usuario.id,
        usuario: usuario.usuario,
        nombre: usuario.nombre,
        rol: usuario.rol,
        unidadId: usuario.unidadId,
        almacenId: usuario.almacenId,
      },
    };
  }

  /** Emite nuevos tokens a partir de un usuario ya validado por el refresh guard. */
  async refresh(user: AuthenticatedUser): Promise<TokensRespuesta> {
    return this.generarTokens(user);
  }

  private async generarTokens(
    user: AuthenticatedUser,
  ): Promise<TokensRespuesta> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      usuario: user.usuario,
      rol: user.rol,
      unidadId: user.unidadId,
      almacenId: user.almacenId,
    };
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      usuario: user.usuario,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        accessPayload,
        this.opcionesFirma('JWT_ACCESS_SECRET', 'JWT_ACCESS_EXPIRES_IN', '15m'),
      ),
      this.jwt.signAsync(
        refreshPayload,
        this.opcionesFirma(
          'JWT_REFRESH_SECRET',
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ),
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /** Arma las opciones de firma. `expiresIn` viene como string formato ms (ej. "15m"). */
  private opcionesFirma(
    secretKey: string,
    expiresKey: string,
    fallback: string,
  ): JwtSignOptions {
    return {
      secret: this.config.get<string>(secretKey),
      expiresIn: (this.config.get<string>(expiresKey) ??
        fallback) as JwtSignOptions['expiresIn'],
    };
  }
}
