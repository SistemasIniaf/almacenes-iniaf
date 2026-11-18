import { Recortar } from '../../../common/dto/validadores';
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

/** El codigo NO se recibe: se autogenera a partir de la partida (ver ItemsService.create). */
export class CreateItemDto {
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'La descripcion es requerida' })
  @MaxLength(300)
  descripcion!: string;

  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @MaxLength(50)
  unidadMedida!: string;

  @Type(() => Number)
  @IsInt({ message: 'La partida es requerida' })
  @Min(1)
  partidaId!: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
