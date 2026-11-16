import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CerrarGestionDto {
  @IsInt({ message: 'Elegí el almacén' })
  almacenId!: number;

  /**
   * La gestion que se quiere cerrar. El backend la calcula sola; se pide igual
   * para que una pantalla vieja (o un doble clic) no cierre la gestion
   * SIGUIENTE sin que nadie la haya visto.
   */
  @IsInt({ message: 'Indicá la gestión a cerrar' })
  @Min(2000)
  gestion!: number;

  /**
   * Obligatorio en true para cerrar la gestion EN CURSO (antes del 31/12): el
   * almacen queda congelado hasta el 1/1.
   */
  @IsOptional()
  @IsBoolean()
  confirmarAnticipado?: boolean;
}
