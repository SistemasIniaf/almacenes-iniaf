import { Recortar } from '../../../common/dto/validadores';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularIngresoDto {
  @IsString()
  @Recortar()
  @IsNotEmpty({ message: 'El motivo de la anulacion es requerido' })
  @MaxLength(500)
  motivo!: string;
}
