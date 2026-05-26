import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemUpdatesService } from './system-updates.service';
import {
  CreateSystemUpdateDto,
  ListSystemUpdatesQueryDto,
  ReviewDecisionDto,
  SystemUpdateCommentDto,
} from './dto/system-update.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';

@ApiTags('system-updates')
@ApiBearerAuth('access-token')
@Controller('system-updates')
export class SystemUpdatesController {
  constructor(private readonly service: SystemUpdatesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List system update requests. Use ?scope=mine|inbox|pending|approved|completed|rejected|all.',
  })
  list(@CurrentUser() me: AuthUser, @Query() query: ListSystemUpdatesQueryDto) {
    return this.service.list(me, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a system update by id' })
  byId(@Param('id') id: string) {
    return this.service.byId(id);
  }

  @Post()
  @Permissions('SYSTEM_UPDATE_CREATE')
  @ApiOperation({ summary: 'Create a system update request' })
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateSystemUpdateDto) {
    return this.service.create(me.id, dto);
  }

  @Post(':id/dev-review')
  @Permissions('SYSTEM_UPDATE_REVIEW_AS_DEV')
  @ApiOperation({
    summary:
      'Developer reviews a PENDING request. Approve advances to DEV_APPROVED, reject marks DEV_REJECTED with reason.',
  })
  devReview(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.service.devReview(me.id, id, dto);
  }

  @Post(':id/admin-review')
  @Permissions('SYSTEM_UPDATE_REVIEW_AS_ADMIN')
  @ApiOperation({
    summary:
      'Admin reviews a PENDING or DEV_APPROVED request. Approve marks ADMIN_APPROVED (final), reject marks ADMIN_REJECTED.',
  })
  adminReview(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.service.adminReview(me.id, id, dto);
  }

  @Post(':id/complete')
  @Permissions('SYSTEM_UPDATE_REVIEW_AS_DEV')
  @ApiOperation({
    summary:
      'Mark an ADMIN_APPROVED request as COMPLETED. Auto-creates a Changelog entry on the related module.',
  })
  complete(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.service.complete(me.id, id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Append a comment to a system update' })
  addComment(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
    @Body() dto: SystemUpdateCommentDto,
  ) {
    return this.service.addComment(me, id, dto);
  }

  @Delete(':id')
  @Permissions('SYSTEM_UPDATE_DELETE')
  @ApiOperation({
    summary:
      'Logical delete (sets deletedAt). Requires SYSTEM_UPDATE_DELETE',
  })
  remove(@Param('id') id: string) {
    return this.service.softDelete(id);
  }
}
