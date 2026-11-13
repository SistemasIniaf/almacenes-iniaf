import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '../../generated/prisma/enums';
import { ImportarSaldosDto } from './dto/importar-saldos.dto';
import { SaldosInicialesService } from './saldos-iniciales.service';

/**
 * Carga inicial de saldos del sistema anterior. Solo super_admin: crea stock
 * de la nada en cualquier almacen, igual que un traspaso o el cierre.
 */
@Roles(Rol.super_admin)
@Controller('saldos-iniciales')
export class SaldosInicialesController {
  constructor(private readonly service: SaldosInicialesService) {}

  /** Revisa la planilla sin grabar nada. POST porque viaja la planilla entera. */
  @Post('validar')
  @HttpCode(200)
  validar(@Body() dto: ImportarSaldosDto) {
    return this.service.validar(dto);
  }

  @Post()
  importar(
    @Body() dto: ImportarSaldosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.importar(dto, user);
  }
}
