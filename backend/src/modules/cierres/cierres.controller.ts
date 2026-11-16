import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '../../generated/prisma/enums';
import { CierresService } from './cierres.service';
import { CerrarGestionDto } from './dto/cerrar-gestion.dto';
import { QueryCierresDto } from './dto/query-cierres.dto';
import { QueryCuadrosDto } from './dto/query-cuadros.dto';

/**
 * Cierre de gestion por almacen (2026-11-16). CERRAR es solo del super_admin;
 * el admin mira (mismo criterio que usuarios: ve pero no ejecuta).
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('cierres')
export class CierresController {
  constructor(private readonly cierresService: CierresService) {}

  /** Que gestion le toca cerrar a cada almacen y que lo traba. */
  @Get('estado')
  estado() {
    return this.cierresService.estado();
  }

  @Roles(Rol.super_admin)
  @Post()
  cerrar(
    @Body() dto: CerrarGestionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cierresService.cerrar(dto, user);
  }

  /** Gestiones con al menos un cierre: el selector de los Cuadros 5 y 6. */
  @Get('gestiones')
  gestiones() {
    return this.cierresService.gestiones();
  }

  /**
   * Datos de los Cuadros 5 y 6 (DGCF R1.05/R1.06). Van declarados ANTES de
   * `:id`, o Nest los tomaria por un id y reventaria el ParseIntPipe.
   */
  @Get('cuadros')
  cuadros(@Query() query: QueryCuadrosDto) {
    return this.cierresService.cuadros(query);
  }

  @Get()
  findAll(@Query() query: QueryCierresDto) {
    return this.cierresService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cierresService.findOne(id);
  }
}
