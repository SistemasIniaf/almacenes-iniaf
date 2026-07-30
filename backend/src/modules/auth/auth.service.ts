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

/**
 * Perfil del usuario logueado. Es MAS que el contenido del token: agrega el
 * nombre, el cargo y los nombres de la unidad y el almacen, que el token no
 * lleva (seria payload que viaja en cada request para datos que casi no cambian).
 * Lo consumen la barra lateral y los formularios que muestran de quien es el
 * documento — el egreso, por ejemplo, hereda unidad y almacen del solicitante y
 * los muestra antes de que exista el registro.
 */
export interface PerfilUsuario extends AuthenticatedUser {
  nombre: string;
  cargo: string | null;
  unidad: { id: number; nombre: string; sigla: string } | null;
  almacen: { id: number; nombre: string } | null;
}

export interface LoginRespuesta extends TokensRespuesta {
  user: PerfilUsuario;
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

    // El perfil se arma con la misma consulta que `GET /auth/me`, para que el
    // login y la rehidratacion devuelvan exactamente la misma forma.
    return { ...tokens, user: await this.perfil(usuario.id) };
  }

  /**
   * Perfil completo desde la BD. NO se sirve del token: ahi solo viajan los ids,
   * y el nombre de la unidad o del almacen puede cambiar sin que el usuario
   * vuelva a loguearse.
   */
  async perfil(usuarioId: number): Promise<PerfilUsuario> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        usuario: true,
        nombre: true,
        cargo: true,
        rol: true,
        unidadId: true,
        almacenId: true,
        unidad: { select: { id: true, nombre: true, sigla: true } },
        almacen: { select: { id: true, nombre: true } },
      },
    });
    // El token es valido pero el usuario ya no existe (o lo borraron): la sesion
    // no vale nada.
    if (!usuario) throw new UnauthorizedException('La sesion ya no es valida');
    return usuario;
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
