import { Module } from '@nestjs/common';

import { IngresosController } from './ingresos.controller';
import { IngresosService } from './ingresos.service';

@Module({
  controllers: [IngresosController],
  providers: [IngresosService],
  exports: [IngresosService],
})
export class IngresosModule {}
