import { Module } from '@nestjs/common';
import { ManualService } from './manual.service';
import { ManualController } from './manual.controller';

@Module({
  controllers: [ManualController],
  providers: [ManualService],
  exports: [ManualService],
})
export class ManualModule {}
