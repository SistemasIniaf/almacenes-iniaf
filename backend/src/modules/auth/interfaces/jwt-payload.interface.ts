import { Rol } from '../../../generated/prisma/enums';

/** Contenido del access token. `sub` es el id del usuario. */
export interface JwtPayload {
  sub: number;
  usuario: string;
  rol: Rol;
  unidadId: number | null;
  almacenId: number | null;
}

/** Contenido del refresh token (minimo, solo identifica al usuario). */
export interface JwtRefreshPayload {
  sub: number;
  usuario: string;
}

/** Usuario autenticado que queda en `request.user` tras validar el access token. */
export interface AuthenticatedUser {
  id: number;
  usuario: string;
  rol: Rol;
  unidadId: number | null;
  almacenId: number | null;
}
