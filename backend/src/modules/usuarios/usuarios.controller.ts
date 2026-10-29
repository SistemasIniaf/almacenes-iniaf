import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Rol } from '../../generated/prisma/enums';
import { ClaveInicialDto } from './dto/clave-inicial.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { QueryUsuariosDto } from './dto/query-usuarios.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

/**
 * Gestion de usuarios. No hay endpoint publico de registro (los usuarios se
 * crean aqui).
 *
 * El `@Roles` de la clase es el de LECTURA (super_admin y admin). Todo lo que
 * escribe —crear, editar, dar de baja, reactivar, restablecer la contraseña— y
 * lo que revela la contraseña inicial es SOLO del super_admin (2026-10-29,
 * pedido del usuario): cada uno de esos metodos lleva su propio `@Roles`.
 */
@Roles(Rol.super_admin, Rol.admin)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Roles(Rol.super_admin)
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

  /**
   * La contraseña inicial de las cuentas nuevas: solo el super_admin, que es
   * quien crea y restablece cuentas. Antes de `:id`, como `mi-aprobador`.
   */
  @Roles(Rol.super_admin)
  @Get('clave-inicial')
  obtenerClaveInicial() {
    return this.usuariosService.obtenerClaveInicial();
  }

  @Roles(Rol.super_admin)
  @Put('clave-inicial')
  actualizarClaveInicial(
    @Body() dto: ClaveInicialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usuariosService.actualizarClaveInicial(dto.claveInicial, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  /** Editar es exclusivo del super_admin (2026-09-29). */
  @Roles(Rol.super_admin)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usuariosService.update(id, dto, user);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usuariosService.remove(id, user);
  }

  /** Reactiva (inverso de la baja logica). */
  @Roles(Rol.super_admin)
  @Post(':id/activar')
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.activar(id);
  }

  /** Usuario + contraseña inicial (si todavía la tiene) para copiar y mandar. */
  @Roles(Rol.super_admin)
  @Get(':id/credenciales')
  credenciales(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.credenciales(id);
  }

  /** Vuelve la contraseña a la inicial. */
  @Roles(Rol.super_admin)
  @Post(':id/restablecer-clave')
  restablecerClave(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usuariosService.restablecerClave(id, user);
  }
}
