import { Module } from '@nestjs/common';

import { TraspasosController } from './traspasos.controller';
import { TraspasosService } from './traspasos.service';

@Module({
  controllers: [TraspasosController],
  providers: [TraspasosService],
})
export class TraspasosModule {}
