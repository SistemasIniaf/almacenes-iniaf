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

import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../../generated/prisma/enums';
import { CreateUnidadDto } from './dto/create-unidad.dto';
import { QueryArbolUnidadesDto } from './dto/query-arbol-unidades.dto';
import { QueryUnidadesDto } from './dto/query-unidades.dto';
import { UpdateUnidadDto } from './dto/update-unidad.dto';
import { UnidadesService } from './unidades.service';

/**
 * Gestion de unidades. Escritura solo super_admin (admin NO gestiona unidades,
 * ver CLAUDE.md). Lectura tambien admin, para poblar selectores al crear usuarios.
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('unidades')
export class UnidadesController {
  constructor(private readonly unidadesService: UnidadesService) {}

  @Roles(Rol.super_admin)
  @Post()
  create(@Body() dto: CreateUnidadDto) {
    return this.unidadesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryUnidadesDto) {
    return this.unidadesService.findAll(query);
  }

  /** Arbol jerarquico completo de unidades (para la vista de arbol). */
  @Get('arbol')
  arbol(@Query() query: QueryArbolUnidadesDto) {
    return this.unidadesService.arbol(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unidadesService.findOne(id);
  }

  @Roles(Rol.super_admin)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUnidadDto) {
    return this.unidadesService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unidadesService.remove(id);
  }
}
