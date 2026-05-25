import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  list(
    @CurrentUser() me: AuthUser,
    @Query('onlyUnread') onlyUnread?: string,
    @Query('take') take?: string,
  ) {
    return this.notifications.list(me.id, {
      onlyUnread: onlyUnread === 'true',
      take: take ? Number(take) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async unreadCount(@CurrentUser() me: AuthUser) {
    return { count: await this.notifications.unreadCount(me.id) };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(me.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() me: AuthUser) {
    return this.notifications.markAllRead(me.id);
  }
}
