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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { imageUploadMulterOptions } from '../../common/uploads/uploads.config';
import { Rol } from '../../generated/prisma/enums';
import { AnularIngresoDto } from './dto/anular-ingreso.dto';
import { CreateIngresoDto } from './dto/create-ingreso.dto';
import { QueryIngresosDto } from './dto/query-ingresos.dto';
import { UpdateIngresoDto } from './dto/update-ingreso.dto';
import { IngresosService } from './ingresos.service';

/**
 * Ingresos de material. Escritura: super_admin, admin, responsable_almacen.
 * Lectura tambien para observador_almacen (auditoria). El scope por almacen lo
 * aplica el service: el responsable ve/opera solo SU almacen; el observador,
 * solo los almacenes que observa; admin/super_admin, todos.
 */
@Roles(
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
)
@Controller('ingresos')
export class IngresosController {
  constructor(private readonly ingresosService: IngresosService) {}

  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post()
  create(
    @Body() dto: CreateIngresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QueryIngresosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.findAll(query, user);
  }

  /**
   * Los ingresos del rango sin paginar, para el reporte imprimible.
   *
   * VA ANTES de `:id`: Nest resuelve las rutas por orden de declaracion y
   * abajo, `/ingresos/reporte` entraria por `findOne` y reventaria el
   * `ParseIntPipe`.
   */
  @Get('reporte')
  reporte(
    @Query() query: QueryIngresosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.reporte(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.findOne(id, user);
  }

  /** Edita solo la cabecera documental (no toca lineas, stock ni fuente). */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.update(id, dto, user);
  }

  /** Anula un ingreso confirmado: reversion en Kardex + devuelve saldos. */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post(':id/anular')
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnularIngresoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.anular(id, dto, user);
  }

  /**
   * Sube/reemplaza la foto de UN lote (campo multipart `imagen`).
   *
   * Sigue disponible con el ingreso ya confirmado, a diferencia de todo lo demas
   * de una linea: la foto no mueve saldo ni correlativo. Asi el almacen puede
   * registrar el ingreso apenas llega el material y cargar las fotos despues.
   * El scope por almacen lo aplica el service (el responsable, solo el suyo).
   */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Post(':id/detalles/:detalleId/imagen')
  @UseInterceptors(FileInterceptor('imagen', imageUploadMulterOptions))
  uploadImagenLote(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.setImagenLote(id, detalleId, file, user);
  }

  /** Quita la foto del lote: vuelve a regir la del catalogo del item. */
  @Roles(Rol.super_admin, Rol.admin, Rol.responsable_almacen)
  @Delete(':id/detalles/:detalleId/imagen')
  removeImagenLote(
    @Param('id', ParseIntPipe) id: number,
    @Param('detalleId', ParseIntPipe) detalleId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ingresosService.removeImagenLote(id, detalleId, user);
  }
}
