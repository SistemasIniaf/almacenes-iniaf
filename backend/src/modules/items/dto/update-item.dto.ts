import { OpcionalNoNulo, Recortar } from '../../../common/dto/validadores';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md).
 * El `codigo` no se edita: lo genera el sistema. `partidaId` y `unidadMedida`
 * solo se aceptan mientras el item no tenga movimientos (lo valida el service);
 * cambiar la partida le asigna un codigo nuevo en la partida destino.
 */
export class UpdateItemDto {
  @OpcionalNoNulo()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partidaId?: number;

  @OpcionalNoNulo()
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'La descripcion no puede estar vacia' })
  @MaxLength(300)
  descripcion?: string;

  @OpcionalNoNulo()
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'La unidad de medida no puede estar vacia' })
  @MaxLength(50)
  unidadMedida?: string;

  @OpcionalNoNulo()
  @IsBoolean()
  activo?: boolean;
}
