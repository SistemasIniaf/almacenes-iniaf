import { Controller, Get, Query } from '@nestjs/common';

import { Rol } from '../../generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { QueryStockDto } from './dto/query-stock.dto';
import { StockService } from './stock.service';

/**
 * Existencias, solo lectura, con scope por almacen: el responsable y el
 * solicitador ven el suyo, el observador los que observa, admin/super_admin
 * todos (ver `almacenesPermitidos`).
 *
 * El SOLICITADOR entra desde 2026-07-29: su pedido apunta a un LOTE, asi que
 * necesita ver que lotes hay y cuanto disponible tiene cada uno. Sin esto no
 * puede armar un egreso.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
  Rol.solicitador,
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

  /** Todas las existencias, sin paginar, para el reporte imprimible. */
  @Get('reporte')
  reporte(
    @Query() query: QueryStockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockService.reporte(query, user);
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
