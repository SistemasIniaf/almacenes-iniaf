import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guard para el endpoint de refresh (valida el refresh token del body). */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
