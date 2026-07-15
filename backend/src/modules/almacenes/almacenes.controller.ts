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
 * Gestion de almacenes (CRUD simple). super_admin y admin tienen acceso total
 * (a diferencia de unidades/partidas, admin SI gestiona almacenes — ver CLAUDE.md).
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('almacenes')
export class AlmacenesController {
  constructor(private readonly almacenesService: AlmacenesService) {}

  @Post()
  create(@Body() dto: CreateAlmacenDto) {
    return this.almacenesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryAlmacenesDto) {
    return this.almacenesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.almacenesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAlmacenDto) {
    return this.almacenesService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.almacenesService.remove(id);
  }
}
