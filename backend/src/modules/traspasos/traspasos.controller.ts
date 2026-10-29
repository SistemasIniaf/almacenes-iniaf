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
import { CreateTraspasoDto } from './dto/create-traspaso.dto';
import {
  QueryLotesTraspasoDto,
  QueryTraspasosDto,
} from './dto/query-traspasos.dto';
import { TraspasosService } from './traspasos.service';

/**
 * Traspasos de material entre almacenes. REGISTRAR es solo del super_admin
 * (version minima, 2026-10-29: es un cambio estructural, como cerrar un
 * almacen). LEER, ademas, para admin, y para el responsable y el observador de
 * los almacenes involucrados (el scope lo aplica el service): el que recibe
 * tiene que poder ver y imprimir lo que le llego.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
)
@Controller('traspasos')
export class TraspasosController {
  constructor(private readonly traspasosService: TraspasosService) {}

  @Roles(Rol.super_admin)
  @Post()
  create(
    @Body() dto: CreateTraspasoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.traspasosService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryTraspasosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.traspasosService.findAll(query, user);
  }

  /**
   * Todos los lotes con saldo de un almacen, con su disponible, para armar el
   * traspaso. Solo super_admin: es la pantalla de alta.
   *
   * VA ANTES de `:id` (si no, `lotes` entraria por el `ParseIntPipe`).
   */
  @Roles(Rol.super_admin)
  @Get('lotes')
  lotes(@Query() query: QueryLotesTraspasoDto) {
    return this.traspasosService.lotesDisponibles(query.almacenId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.traspasosService.findOne(id, user);
  }
}
