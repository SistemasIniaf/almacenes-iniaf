import { Module } from '@nestjs/common';

import { SaldosInicialesController } from './saldos-iniciales.controller';
import { SaldosInicialesService } from './saldos-iniciales.service';

@Module({
  controllers: [SaldosInicialesController],
  providers: [SaldosInicialesService],
})
export class SaldosInicialesModule {}
