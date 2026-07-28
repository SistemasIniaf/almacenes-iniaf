import { Module } from '@nestjs/common';

import { KardexController } from './kardex.controller';
import { KardexService } from './kardex.service';

@Module({
  controllers: [KardexController],
  providers: [KardexService],
  exports: [KardexService],
})
export class KardexModule {}
