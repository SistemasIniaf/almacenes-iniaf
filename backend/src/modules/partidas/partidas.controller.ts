import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../../generated/prisma/enums';
import { PartidasService } from './partidas.service';
import { QueryArbolDto } from './dto/query-arbol.dto';
import { QueryPartidasDto } from './dto/query-partidas.dto';

/**
 * Partidas: catalogo oficial del Clasificador por Objeto del Gasto. NO se crean
 * ni editan a mano (vienen del seed) — solo lectura y activar/desactivar.
 * Lectura: super_admin y admin. Escritura (activar/desactivar): solo super_admin
 * (admin NO gestiona partidas — ver CLAUDE.md).
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('partidas')
export class PartidasController {
  constructor(private readonly partidasService: PartidasService) {}

  @Get()
  findAll(@Query() query: QueryPartidasDto) {
    return this.partidasService.findAll(query);
  }

  /** Arbol jerarquico completo (raices con hijos anidados). */
  @Get('arbol')
  arbol(@Query() query: QueryArbolDto) {
    return this.partidasService.arbol(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.partidasService.findOne(id);
  }

  @Roles(Rol.super_admin)
  @Patch(':id/activar')
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.partidasService.activar(id);
  }

  @Roles(Rol.super_admin)
  @Patch(':id/desactivar')
  desactivar(@Param('id', ParseIntPipe) id: number) {
    return this.partidasService.desactivar(id);
  }
}
