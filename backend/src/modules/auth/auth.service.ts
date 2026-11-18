import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { CambiarClaveDto } from './dto/cambiar-clave.dto';
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

  /**
   * Freno a la fuerza bruta (2026-11-18): tras `MAX_FALLOS` contraseñas
   * equivocadas seguidas para un mismo usuario, esa cuenta no acepta mas
   * intentos por `BLOQUEO_MS`. Importa mas de lo comun aca porque las cuentas
   * nuevas comparten la contraseña inicial.
   *
   * Vive en MEMORIA: se pierde al reiniciar y no se comparte entre procesos,
   * que para un solo backend alcanza. Cuenta tambien los usuarios que no
   * existen, para no revelar cuales si.
   */
  private readonly fallos = new Map<string, { n: number; hasta: number }>();
  private static readonly MAX_FALLOS = 10;
  private static readonly BLOQUEO_MS = 15 * 60 * 1000;

  private exigirSinBloqueo(clave: string) {
    const f = this.fallos.get(clave);
    if (!f) return;
    if (f.hasta <= Date.now()) {
      this.fallos.delete(clave);
      return;
    }
    if (f.n >= AuthService.MAX_FALLOS) {
      const minutos = Math.ceil((f.hasta - Date.now()) / 60000);
      throw new HttpException(
        `Demasiados intentos fallidos. Probá de nuevo en ${minutos} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private anotarFallo(clave: string) {
    // Tope de memoria: si alguien prueba miles de usuarios distintos, se
    // descartan los registros ya vencidos (y, si no alcanza, todos).
    if (this.fallos.size > 5000) {
      const ahora = Date.now();
      for (const [k, v] of this.fallos) {
        if (v.hasta <= ahora) this.fallos.delete(k);
      }
      if (this.fallos.size > 5000) this.fallos.clear();
    }
    const f = this.fallos.get(clave);
    this.fallos.set(clave, {
      n: (f?.n ?? 0) + 1,
      hasta: Date.now() + AuthService.BLOQUEO_MS,
    });
  }

  /** Valida credenciales y emite access + refresh token. */
  async login(dto: LoginDto): Promise<LoginRespuesta> {
    const clave = dto.usuario.trim().toLowerCase();
    this.exigirSinBloqueo(clave);

    const usuario = await this.prisma.usuario.findUnique({
      where: { usuario: dto.usuario },
    });

    // Mensaje generico para no revelar si el usuario existe.
    const credencialesInvalidas = new UnauthorizedException(
      'Usuario o contrasena incorrectos',
    );

    if (!usuario) {
      this.anotarFallo(clave);
      throw credencialesInvalidas;
    }

    const passwordOk = await bcrypt.compare(dto.password, usuario.password);
    if (!passwordOk) {
      this.anotarFallo(clave);
      throw credencialesInvalidas;
    }
    this.fallos.delete(clave);

    // Recien ACA se distingue la baja (con un mensaje que SI dice algo del
    // usuario): la contrasena ya se valido, asi que a esta altura quien
    // pregunta ya la conoce -- no es un intento de adivinar si la cuenta
    // existe, es probablemente el dueno de la cuenta.
    if (!usuario.activo) {
      throw new UnauthorizedException(
        'Esta cuenta esta dada de baja. Consulta con un administrador.',
      );
    }

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

  /**
   * Cada usuario cambia SU contraseña (2026-10-29): antes solo el super_admin
   * podia, editando al usuario, y terminaba conociendo la clave de todos.
   *
   * La actual mal responde 400 y NO 401 a proposito: el interceptor del
   * frontend toma un 401 como sesion vencida, intenta el refresh y, si no
   * alcanza, cierra la sesion — un error de tipeo te sacaria del sistema.
   *
   * No invalida las otras sesiones abiertas: los refresh tokens son sin estado
   * y siguen valiendo hasta que vencen (7 dias).
   */
  async cambiarClave(usuarioId: number, dto: CambiarClaveDto): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { password: true },
    });
    if (!usuario) throw new UnauthorizedException('La sesion ya no es valida');

    if (!(await bcrypt.compare(dto.actual, usuario.password))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (dto.nueva === dto.actual) {
      throw new BadRequestException(
        'La contraseña nueva tiene que ser distinta de la actual',
      );
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      // Recién ahora la contraseña es solo suya (la marca de la tabla de
      // Usuarios y el ícono de copiar dejan de ofrecer la inicial).
      data: {
        password: await bcrypt.hash(dto.nueva, 10),
        conClaveInicial: false,
      },
    });
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
