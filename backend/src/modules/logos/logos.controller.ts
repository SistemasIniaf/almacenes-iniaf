import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { LogoClave, Rol } from '../../generated/prisma/enums';
import { imageUploadMulterOptions } from '../../common/uploads/uploads.config';
import { LogosService } from './logos.service';

/**
 * Logos institucionales (INIAF, su version para fondo oscuro y Ministerio),
 * con HISTORIAL: cada logo subido queda guardado como version y se puede
 * volver a usar.
 *
 * Escritura solo `super_admin`: es identidad institucional que sale impresa en
 * todos los documentos, mismo criterio que los catalogos estructurales.
 */
@Controller('logos')
export class LogosController {
  constructor(private readonly logosService: LogosService) {}

  /**
   * Los tres casilleros, con la ruta del logo vigente o `null` (= el original).
   * PUBLICO: el login los dibuja antes de que exista una sesion. No expone nada
   * que no este ya a la vista en la pantalla de login.
   */
  @Public()
  @Get()
  findAll() {
    return this.logosService.findAll();
  }

  /** Todas las versiones subidas (el historial de los tres casilleros). */
  @Roles(Rol.super_admin)
  @Get('historial')
  historial() {
    return this.logosService.historial();
  }

  /** Sube un logo nuevo (campo multipart `imagen`) y lo pone vigente. */
  @Roles(Rol.super_admin)
  @Post(':clave')
  @UseInterceptors(FileInterceptor('imagen', imageUploadMulterOptions))
  reemplazar(
    @Param('clave', new ParseEnumPipe(LogoClave)) clave: LogoClave,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logosService.reemplazar(clave, file, user);
  }

  /** Vuelve a poner vigente una version del historial. */
  @Roles(Rol.super_admin)
  @HttpCode(HttpStatus.OK)
  @Post('versiones/:id/usar')
  usarVersion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.logosService.usarVersion(id, user);
  }

  /** Borra una version del historial (nunca la vigente). */
  @Roles(Rol.super_admin)
  @Delete('versiones/:id')
  eliminarVersion(@Param('id', ParseIntPipe) id: number) {
    return this.logosService.eliminarVersion(id);
  }

  /** Vuelve al logo original de la aplicacion. El historial se conserva. */
  @Roles(Rol.super_admin)
  @Delete(':clave')
  restaurar(@Param('clave', new ParseEnumPipe(LogoClave)) clave: LogoClave) {
    return this.logosService.restaurar(clave);
  }
}
