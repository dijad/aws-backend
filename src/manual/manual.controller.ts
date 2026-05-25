import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ManualService } from './manual.service';
import {
  CreateFeatureDocumentDto,
  UpdateFeatureDocumentDto,
} from './dto/manual.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';

@ApiTags('manual')
@ApiBearerAuth('access-token')
@Controller()
export class ManualController {
  constructor(private readonly manual: ManualService) {}

  @Get('manual/search')
  @ApiOperation({ summary: 'Full-text-ish search over published documents' })
  search(@Query('q') q: string) {
    return this.manual.search(q ?? '');
  }

  @Get('modules/:idOrSlug/docs')
  @ApiOperation({
    summary:
      'List documents under a module. Drafts are only included when ?includeDrafts=true.',
  })
  listDocs(
    @Param('idOrSlug') idOrSlug: string,
    @Query('includeDrafts') includeDrafts?: string,
  ) {
    return this.manual.listDocs(idOrSlug, includeDrafts === 'true');
  }

  @Get('modules/:idOrSlug/docs/:docSlug')
  @ApiOperation({ summary: 'Get a single document inside a module' })
  getDoc(
    @Param('idOrSlug') idOrSlug: string,
    @Param('docSlug') docSlug: string,
  ) {
    return this.manual.getDoc(idOrSlug, docSlug);
  }

  @Post('modules/:idOrSlug/docs')
  @Permissions('MANUAL_EDIT')
  @ApiOperation({ summary: 'Create a draft document inside a module' })
  createDoc(
    @CurrentUser() me: AuthUser,
    @Param('idOrSlug') idOrSlug: string,
    @Body() dto: CreateFeatureDocumentDto,
  ) {
    return this.manual.createDoc(me.id, idOrSlug, dto);
  }

  @Patch('docs/:id')
  @Permissions('MANUAL_EDIT')
  @ApiOperation({ summary: 'Update a document' })
  updateDoc(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDocumentDto,
  ) {
    return this.manual.updateDoc(id, dto);
  }

  @Post('docs/:id/publish')
  @Permissions('MANUAL_PUBLISH')
  @ApiOperation({ summary: 'Publish a document' })
  publishDoc(@Param('id') id: string) {
    return this.manual.publishDoc(id);
  }

  @Post('docs/:id/unpublish')
  @Permissions('MANUAL_PUBLISH')
  @ApiOperation({ summary: 'Move a document back to draft' })
  unpublishDoc(@Param('id') id: string) {
    return this.manual.unpublishDoc(id);
  }

  @Get('modules/:idOrSlug/changelog')
  @ApiOperation({
    summary:
      'List the auto-generated changelog entries (from completed system updates) for a module',
  })
  changelog(@Param('idOrSlug') idOrSlug: string) {
    return this.manual.listChangelog(idOrSlug);
  }
}
