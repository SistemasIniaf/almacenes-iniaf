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
import { CreateProveedorDto } from './dto/create-proveedor.dto';
import { QueryProveedoresDto } from './dto/query-proveedores.dto';
import { UpdateProveedorDto } from './dto/update-proveedor.dto';
import { ProveedoresService } from './proveedores.service';

/**
 * Gestion de proveedores. Escritura para super_admin y admin (a diferencia de
 * unidades/partidas, admin SI gestiona proveedores — ver CLAUDE.md).
 * Lectura tambien para responsable_almacen: necesita el selector de proveedor
 * al registrar un Ingreso.
 */
@Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Roles(Rol.super_admin, Rol.admin)
  @Post()
  create(@Body() dto: CreateProveedorDto) {
    return this.proveedoresService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryProveedoresDto) {
    return this.proveedoresService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.findOne(id);
  }

  @Roles(Rol.super_admin, Rol.admin)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProveedorDto,
  ) {
    return this.proveedoresService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin, Rol.admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.remove(id);
  }
}
