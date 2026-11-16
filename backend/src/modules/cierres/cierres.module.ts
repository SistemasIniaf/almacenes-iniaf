import { Module } from '@nestjs/common';

import { CierresController } from './cierres.controller';
import { CierresService } from './cierres.service';

@Module({
  controllers: [CierresController],
  providers: [CierresService],
})
export class CierresModule {}
