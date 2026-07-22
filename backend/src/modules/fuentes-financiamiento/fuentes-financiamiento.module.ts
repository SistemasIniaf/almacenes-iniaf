import { Module } from '@nestjs/common';

import { FuentesFinanciamientoController } from './fuentes-financiamiento.controller';
import { FuentesFinanciamientoService } from './fuentes-financiamiento.service';

@Module({
  controllers: [FuentesFinanciamientoController],
  providers: [FuentesFinanciamientoService],
  exports: [FuentesFinanciamientoService],
})
export class FuentesFinanciamientoModule {}
