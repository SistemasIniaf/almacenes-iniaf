import { Recortar } from '../../../common/dto/validadores';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFuenteFinanciamientoDto {
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'El codigo no puede estar vacio' })
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
