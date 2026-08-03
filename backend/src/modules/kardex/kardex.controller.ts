import { Controller, Get, Query } from '@nestjs/common';

import { Rol } from '../../generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { QueryKardexDto } from './dto/query-kardex.dto';
import { QueryReporteKardexDto } from './dto/query-reporte-kardex.dto';
import { KardexService } from './kardex.service';

/**
 * Kardex, solo lectura. Mismos roles y mismo scope por almacen que ingresos y
 * stock: el responsable ve el suyo, el observador los que observa,
 * admin/super_admin todos.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
)
@Controller('kardex')
export class KardexController {
  constructor(private readonly kardexService: KardexService) {}

  @Get()
  findAll(
    @Query() query: QueryKardexDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kardexService.findAll(query, user);
  }

  /**
   * El kardex de TODOS los items del almacen, sin paginar, para el reporte
   * imprimible. A diferencia de `findAll`, el item es opcional.
   */
  @Get('reporte')
  reporte(
    @Query() query: QueryReporteKardexDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kardexService.reporte(query, user);
  }
}
