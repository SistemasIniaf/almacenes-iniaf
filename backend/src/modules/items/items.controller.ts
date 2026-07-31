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

import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '../../generated/prisma/enums';
import { imageUploadMulterOptions } from '../../common/uploads/uploads.config';
import { CreateItemDto } from './dto/create-item.dto';
import { ItemsService } from './items.service';
import { QueryItemsDto } from './dto/query-items.dto';
import { UpdateItemDto } from './dto/update-item.dto';

/**
 * Items: catalogo compartido por todos los almacenes. La escritura es
 * administrativa (super_admin/admin).
 *
 * La LECTURA estaba abierta a cualquier autenticado «porque el solicitador
 * necesita el catalogo para armar sus egresos». Eso valia cuando la linea del
 * egreso apuntaba a un ITEM; desde el 2026-07-29 apunta a un LOTE y su selector
 * consulta `GET /stock`. Asi que el 2026-07-31 se recorto a quienes de verdad lo
 * consumen: el buscador del KARDEX y el selector de item del formulario de
 * INGRESO. Solicitador y aprobador ya no lo necesitan — eran 23.000 registros
 * que no usaban para nada.
 */
const ROLES_LECTURA = [
  Rol.super_admin,
  Rol.admin,
  Rol.responsable_almacen,
  Rol.observador_almacen,
] as const;

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  /** El codigo se autogenera desde la partida; no se recibe del cliente. */
  @Roles(Rol.super_admin, Rol.admin)
  @Post()
  create(@Body() dto: CreateItemDto) {
    return this.itemsService.create(dto);
  }

  @Roles(...ROLES_LECTURA)
  @Get()
  findAll(@Query() query: QueryItemsDto) {
    return this.itemsService.findAll(query);
  }

  @Roles(...ROLES_LECTURA)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.findOne(id);
  }

  @Roles(Rol.super_admin, Rol.admin)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(id, dto);
  }

  /**
   * Sube/reemplaza la imagen referencial del item (campo multipart `imagen`).
   * Se procesa a WebP y se guarda en filesystem; la DB solo guarda la ruta.
   */
  @Roles(Rol.super_admin, Rol.admin)
  @Post(':id/imagen')
  @UseInterceptors(FileInterceptor('imagen', imageUploadMulterOptions))
  uploadImagen(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.itemsService.setImagen(id, file);
  }

  /** Quita la imagen del item. */
  @Roles(Rol.super_admin, Rol.admin)
  @Delete(':id/imagen')
  removeImagen(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.removeImagen(id);
  }

  /** Baja logica (desactiva). */
  @Roles(Rol.super_admin, Rol.admin)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.remove(id);
  }
}
