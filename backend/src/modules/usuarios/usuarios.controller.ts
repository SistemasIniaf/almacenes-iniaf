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

  /** Solicitadores activos (para el selector de responsable / comision de recepcion del Ingreso). */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Get('solicitadores')
  solicitadores() {
    return this.usuariosService.solicitadores();
  }

  /**
   * Quien aprueba MIS pedidos: el aprobador activo de mi unidad. Lo usa el
   * dialogo que confirma el envio de un egreso, para decir a quien le va a
   * llegar. Abierto al `solicitador` —es de su propia unidad, no es leer el
   * padron— y devuelve solo id, nombre y cargo.
   *
   * Va ANTES de `:id` a proposito: si no, Nest tomaria "mi-aprobador" como el
   * parametro y `ParseIntPipe` responderia 400.
   */
  @Roles(Rol.super_admin, Rol.admin, Rol.solicitador)
  @Get('mi-aprobador')
  miAprobador(@CurrentUser() user: AuthenticatedUser) {
    if (user.unidadId == null) return null;
    return this.usuariosService.aprobadorDeUnidad(user.unidadId);
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
