import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-permissions.dto';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller()
export class RolesController {
  constructor(private readonly rolesSvc: RolesService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List roles with their assigned permissions' })
  listRoles() {
    return this.rolesSvc.listRoles();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List every available permission' })
  listPermissions() {
    return this.rolesSvc.listPermissions();
  }

  @Post('roles')
  @Permissions('ROLE_MANAGE')
  @ApiOperation({ summary: 'Create a custom role' })
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesSvc.createRole(dto);
  }

  @Patch('roles/:id')
  @Permissions('ROLE_MANAGE')
  @ApiOperation({ summary: 'Update role name and description' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesSvc.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @Permissions('ROLE_MANAGE')
  @ApiOperation({
    summary: 'Logical delete (sets deletedAt). Requires ROLE_MANAGE',
  })
  removeRole(@Param('id') id: string) {
    return this.rolesSvc.softDelete(id);
  }

  @Put('roles/:id/permissions')
  @Permissions('ROLE_MANAGE')
  @ApiOperation({
    summary: 'Replace the permission set assigned to a role',
  })
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesSvc.setRolePermissions(id, dto.permissionCodes);
  }
}
