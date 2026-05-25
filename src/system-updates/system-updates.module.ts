import { Module } from '@nestjs/common';
import { SystemUpdatesService } from './system-updates.service';
import { SystemUpdatesController } from './system-updates.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [SystemUpdatesController],
  providers: [SystemUpdatesService],
  exports: [SystemUpdatesService],
})
export class SystemUpdatesModule {}
