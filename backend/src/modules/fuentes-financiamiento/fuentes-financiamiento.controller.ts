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
import { CreateFuenteFinanciamientoDto } from './dto/create-fuente-financiamiento.dto';
import { QueryFuentesFinanciamientoDto } from './dto/query-fuentes-financiamiento.dto';
import { UpdateFuenteFinanciamientoDto } from './dto/update-fuente-financiamiento.dto';
import { FuentesFinanciamientoService } from './fuentes-financiamiento.service';

/**
 * Catalogo de fuentes de financiamiento. Escritura para super_admin y admin.
 * Lectura tambien para responsable_almacen: necesita el selector de fuente en
 * la cabecera al registrar un Ingreso (una sola fuente por ingreso).
 */
@Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
@Controller('fuentes-financiamiento')
export class FuentesFinanciamientoController {
  constructor(private readonly fuentesService: FuentesFinanciamientoService) {}

  @Roles(Rol.super_admin, Rol.admin)
  @Post()
  create(@Body() dto: CreateFuenteFinanciamientoDto) {
    return this.fuentesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryFuentesFinanciamientoDto) {
    return this.fuentesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fuentesService.findOne(id);
  }

  @Roles(Rol.super_admin, Rol.admin)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFuenteFinanciamientoDto,
  ) {
    return this.fuentesService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin, Rol.admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.fuentesService.remove(id);
  }
}
