import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
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
