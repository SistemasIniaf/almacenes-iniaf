import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * Inyecta el usuario autenticado (o una de sus propiedades) en el handler.
 * Uso: `@CurrentUser() user: AuthenticatedUser` o `@CurrentUser('id') id: number`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
