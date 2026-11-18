import { OpcionalNoNulo, Recortar } from '../../../common/dto/validadores';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md). */
export class UpdateFuenteFinanciamientoDto {
  @OpcionalNoNulo()
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
  @MaxLength(150)
  nombre?: string;

  /** Enviar cadena vacia para limpiar el codigo (se normaliza a null). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @OpcionalNoNulo()
  @IsBoolean()
  activo?: boolean;
}
