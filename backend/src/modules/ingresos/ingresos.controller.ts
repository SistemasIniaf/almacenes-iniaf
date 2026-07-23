import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '../../generated/prisma/enums';
import { AnularIngresoDto } from './dto/anular-ingreso.dto';
import { CreateIngresoDto } from './dto/create-ingreso.dto';
import { QueryIngresosDto } from './dto/query-ingresos.dto';
import { UpdateIngresoDto } from './dto/update-ingreso.dto';
import { IngresosService } from './ingresos.service';

/**
 * Ingresos de material. Escritura: super_admin, admin, responsable_almacen.
 * Lectura tambien para observador_almacen (auditoria). El scope por almacen lo
 * aplica el service: el responsable ve/opera solo SU almacen; el observador,
 * solo los almacenes que observa; admin/super_admin, todos.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
)
@Controller('ingresos')
export class IngresosController {
  constructor(private readonly ingresosService: IngresosService) {}

  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post()
  create(
    @Body() dto: CreateIngresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryIngresosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.findOne(id, user);
  }

  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.update(id, dto, user);
  }

  /** Confirma el ingreso: estampa el numero, crea los lotes y el Kardex. */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post(':id/confirmar')
  confirmar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.confirmar(id, user);
  }

  /** Anula un ingreso confirmado: reversion en Kardex + devuelve saldos. */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularIngresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.anular(id, dto, user);
  }

  /** Elimina un borrador (los confirmados no se borran: se anulan). */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.remove(id, user);
  }
}
