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
import { CreateItemDto } from './dto/create-item.dto';
import { ItemsService } from './items.service';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

/**
 * Items: catalogo compartido por todos los almacenes. La escritura es
 * administrativa (super_admin/admin); la lectura queda abierta a cualquier
 * usuario autenticado porque el solicitador necesita el catalogo para armar
 * sus egresos (ver ComboboxField de Item en CLAUDE.md).
 */
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  /** El codigo se autogenera desde la partida; no se recibe del cliente. */
  @Roles(Rol.super_admin, Rol.admin)
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryItemsDto) {
    return this.itemsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.findOne(id);
  }

  @Roles(Rol.super_admin, Rol.admin)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin, Rol.admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.remove(id);
  }
}
