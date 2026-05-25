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
import { ModulesService } from './modules.service';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('modules')
@ApiBearerAuth('access-token')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  @ApiOperation({ summary: 'List modules. Active by default.' })
  list(@Query('includeInactive') includeInactive?: string) {
    return this.modules.list(includeInactive === 'true');
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get module by id or slug' })
  byIdOrSlug(@Param('idOrSlug') idOrSlug: string) {
    return this.modules.byIdOrSlug(idOrSlug);
  }

  @Post()
  @Permissions('MODULE_MANAGE')
  @ApiOperation({ summary: 'Create module (requires MODULE_MANAGE)' })
  create(@Body() dto: CreateModuleDto) {
    return this.modules.create(dto);
  }

  @Patch(':id')
  @Permissions('MODULE_MANAGE')
  @ApiOperation({ summary: 'Update module' })
  update(@Param('id') id: string, @Body() dto: UpdateModuleDto) {
    return this.modules.update(id, dto);
  }

  @Delete(':id')
  @Permissions('MODULE_MANAGE')
  @ApiOperation({ summary: 'Soft-disable a module (sets isActive=false)' })
  remove(@Param('id') id: string) {
    return this.modules.remove(id);
  }
}
