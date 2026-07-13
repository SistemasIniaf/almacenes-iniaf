import { SetMetadata } from '@nestjs/common';

import { Rol } from '../../../generated/prisma/enums';

/** Restringe un endpoint a los roles indicados. Se evalua en RolesGuard. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
