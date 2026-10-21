import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partidaId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La descripcion no puede estar vacia' })
  @MaxLength(300)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La unidad de medida no puede estar vacia' })
  @MaxLength(50)
  unidadMedida?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
