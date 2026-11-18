import { EsDecimal, MAX_CANTIDAD } from '../../../common/dto/validadores';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';

/** Cuanto se entrega de una linea. La ajusta SOLO el responsable de almacen. */
export class EntregaLineaDto {
  @IsInt()
  detalleId!: number;

  /**
   * Puede ser CERO: negar un item sin rechazar el pedido entero es un caso real
   * (el 6,1% de las lineas del sistema anterior se entregaron en cero). No puede
   * superar lo solicitado — el jefe de unidad aprobo esa cantidad.
   */
  @EsDecimal(2, {
    max: MAX_CANTIDAD,
    message: 'La cantidad admite hasta 2 decimales (maximo 9.999.999.999,99)',
  })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidadEntregada!: number;
}

/**
 * Entrega del material: descarga el stock de los lotes y escribe la SALIDA en el
 * Kardex. Hay que mandar TODAS las lineas del pedido, aunque alguna vaya en
 * cero, para que quede explicito que se entrego de cada una.
 */
export class EntregarEgresoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntregaLineaDto)
  lineas!: EntregaLineaDto[];
}
