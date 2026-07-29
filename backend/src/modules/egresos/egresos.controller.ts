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
import { CreateEgresoDto } from './dto/create-egreso.dto';
import { EgresosService } from './egresos.service';
import { EntregarEgresoDto } from './dto/entregar-egreso.dto';
import { MotivoDto } from './dto/decision-egreso.dto';
import { QueryEgresosDto } from './dto/query-egresos.dto';
import { UpdateEgresoDto } from './dto/update-egreso.dto';

/**
 * Pedidos de material. Cada accion la habilita el rol que le toca en el
 * circuito, y ADEMAS el service verifica el alcance (que el pedido sea de tu
 * unidad, de tu almacen o tuyo): el decorador dice quien puede intentarlo, el
 * service dice sobre que.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.solicitador,
  Rol.aprobador,
  Rol.responsable_almacen,
  Rol.observador_almacen,
)
@Controller('egresos')
export class EgresosController {
  constructor(private readonly egresosService: EgresosService) {}

  @Get()
  findAll(
    @Query() query: QueryEgresosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.findAll(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.findOne(id, user);
  }

  /** Crea el pedido como BORRADOR (solo el solicitador, para su unidad). */
  @Roles(Rol.solicitador)
  @Post()
  create(@Body() dto: CreateEgresoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.egresosService.create(dto, user);
  }

  /** Edita el borrador. Enviado, el pedido ya no vuelve a manos del solicitante. */
  @Roles(Rol.solicitador)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEgresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.update(id, dto, user);
  }

  /** Descarta un borrador (todavia no es documento: se borra de verdad). */
  @Roles(Rol.solicitador)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.remove(id, user);
  }

  /** Lo manda al jefe de unidad. Aca se estampa el correlativo. */
  @Roles(Rol.solicitador)
  @Post(':id/enviar')
  enviar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.enviar(id, user);
  }

  /** Nivel 1: el jefe de la unidad. No ajusta cantidades. */
  @Roles(Rol.super_admin, Rol.admin, Rol.aprobador)
  @Post(':id/aprobar')
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.aprobar(id, user);
  }

  /** Rechazo desde cualquiera de los dos niveles: vuelve al solicitante. */
  @Roles(Rol.super_admin, Rol.admin, Rol.aprobador, Rol.responsable_almacen)
  @Post(':id/rechazar')
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotivoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.rechazar(id, dto, user);
  }

  /** Nivel 2: el responsable entrega, ajusta cantidades y descarga el stock. */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post(':id/entregar')
  entregar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EntregarEgresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.entregar(id, dto, user);
  }

  /** Devuelve el material a sus lotes + REVERSION en el Kardex. */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotivoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.egresosService.anular(id, dto, user);
  }
}
