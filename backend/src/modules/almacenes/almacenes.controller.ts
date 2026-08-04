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
import { AlmacenesService } from './almacenes.service';
import { CreateAlmacenDto } from './dto/create-almacen.dto';
import { QueryAlmacenesDto } from './dto/query-almacenes.dto';
import { UpdateAlmacenDto } from './dto/update-almacen.dto';

/**
 * Gestion de almacenes (CRUD simple). Escritura solo super_admin — igual que
 * unidades y partidas: son los tres catalogos estructurales del sistema y los
 * gestiona un unico rol (ver CLAUDE.md). Lectura tambien admin, para poblar
 * selectores al crear usuarios.
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('almacenes')
export class AlmacenesController {
  constructor(private readonly almacenesService: AlmacenesService) {}

  @Roles(Rol.super_admin)
  @Post()
  create(@Body() dto: CreateAlmacenDto) {
    return this.almacenesService.create(dto);
  }

  // Lectura tambien para responsable_almacen y observador_almacen: el primero
  // necesita las unidades de su almacen al registrar un Ingreso (selector de
  // "unidad solicitante"); el segundo, los NOMBRES para poder filtrar entre los
  // almacenes que observa (ingresos, stock). Leer el catalogo no dice nada de
  // que puedan VER de cada almacen — eso lo acota `almacenesPermitidos`.
  @Roles(
    Rol.super_admin,
    Rol.admin,
    Rol.responsable_almacen,
    Rol.observador_almacen,
  )
  @Get()
  findAll(@Query() query: QueryAlmacenesDto) {
    return this.almacenesService.findAll(query);
  }

  @Roles(
    Rol.super_admin,
    Rol.admin,
    Rol.responsable_almacen,
    Rol.observador_almacen,
  )
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.almacenesService.findOne(id);
  }

  @Roles(Rol.super_admin)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAlmacenDto) {
    return this.almacenesService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.almacenesService.remove(id);
  }
}
