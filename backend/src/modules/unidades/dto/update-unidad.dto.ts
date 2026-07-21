import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Campos opcionales (definido explicito, no con PartialType — ver CLAUDE.md). */
export class UpdateUnidadDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede estar vacio' })
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'La sigla no puede estar vacia' })
  @MaxLength(20)
  sigla?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** null = mover a raiz; number = cambiar padre. */
  @IsOptional()
  @IsInt({ message: 'El padre debe ser un id de unidad valido' })
  padreId?: number | null;
}
