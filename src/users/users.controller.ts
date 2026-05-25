import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/types/auth-user.type';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List users (basic profile). Returns active users by default.',
  })
  list(@Query('includeDeleted') includeDeleted?: string) {
    return this.users.list(includeDeleted === 'true');
  }

  @Get('search/lite')
  @ApiOperation({
    summary:
      'List active users in a lightweight payload, used by mention/recipient pickers.',
  })
  searchLite() {
    return this.users.listActiveLite();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one user' })
  byId(@Param('id') id: string) {
    return this.users.byId(id);
  }

  @Post()
  @Permissions('USER_CREATE')
  @ApiOperation({ summary: 'Create a user (requires USER_CREATE)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @Permissions('USER_UPDATE')
  @ApiOperation({ summary: 'Update a user (requires USER_UPDATE)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Permissions('USER_DELETE')
  @ApiOperation({
    summary: 'Logical delete (sets deletedAt). Requires USER_DELETE',
  })
  remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.users.softDelete(id, me.id);
  }
}
