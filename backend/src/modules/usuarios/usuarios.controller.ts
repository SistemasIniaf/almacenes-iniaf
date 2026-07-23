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
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Gestion de usuarios. Accion administrativa: solo super_admin y admin.
 * No hay endpoint publico de registro (los usuarios se crean aqui).
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryUsuariosDto) {
    return this.usuariosService.findAll(query);
  }

  /** Solicitadores activos (para el selector de responsable de conformidad del Ingreso). */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Get('solicitadores')
  solicitadores() {
    return this.usuariosService.solicitadores();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, dto);
  }

  /** Baja logica (desactiva). */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }
}
