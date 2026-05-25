import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import {
  CreateNoteDto,
  CreateSubNoteDto,
  ListNotesQueryDto,
  RejectNoteDto,
} from './dto/note.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';

@ApiTags('notes')
@ApiBearerAuth('access-token')
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ApiOperation({
    summary:
      'List notes scoped to the current user. Use ?scope=mine|mentions|received|pending|approved|rejected|all (all requires NOTE_APPROVE_REJECT).',
  })
  list(@CurrentUser() me: AuthUser, @Query() query: ListNotesQueryDto) {
    return this.notes.list(me, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a note by id' })
  byId(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.notes.byId(me, id);
  }

  @Post()
  @Permissions('NOTE_CREATE')
  @ApiOperation({
    summary:
      'Create a note. PENDING by default; ADMIN role or NOTE_SKIP_APPROVAL publishes immediately as APPROVED.',
  })
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateNoteDto) {
    return this.notes.create(me, dto);
  }

  @Post(':id/approve')
  @Permissions('NOTE_APPROVE_REJECT')
  @ApiOperation({ summary: 'Approve a pending note' })
  approve(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.notes.approve(me.id, id);
  }

  @Post(':id/reject')
  @Permissions('NOTE_APPROVE_REJECT')
  @ApiOperation({ summary: 'Reject a pending note with a reason' })
  reject(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectNoteDto,
  ) {
    return this.notes.reject(me.id, id, dto);
  }

  @Post(':id/sub-notes')
  @ApiOperation({
    summary:
      'Add a comment (sub-note) to a note. Author and approvers can comment.',
  })
  addSubNote(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSubNoteDto,
  ) {
    return this.notes.addSubNote(me, id, dto);
  }
}
