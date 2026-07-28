import { Controller, Get, Query } from '@nestjs/common';

import { Rol } from '../../generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { QueryStockDto } from './dto/query-stock.dto';
import { StockService } from './stock.service';

/**
 * Existencias, solo lectura. Los mismos roles que leen ingresos, con el mismo
 * scope por almacen: el responsable ve el suyo, el observador los que observa,
 * admin/super_admin todos.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
)
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  findAll(
    @Query() query: QueryStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.findAll(query, user);
  }

  /** Partidas con existencias, para el selector de la pantalla de stock. */
  @Get('partidas')
  partidas(
    @Query() query: QueryStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.partidasConStock(query, user);
  }
}
