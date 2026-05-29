import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const NOT_DELETED = { deletedAt: null } as const;

const roleWithPermissions = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

export function normalizeRoleCode(input: string): string {
  const code = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  if (!code || !/^[A-Z][A-Z0-9_]*$/.test(code)) {
    throw new BadRequestException(
      'Role code must start with a letter and contain only A-Z, 0-9, and underscores',
    );
  }
  return code;
}

function toRoleDto(
  role: Prisma.RoleGetPayload<{ include: typeof roleWithPermissions }>,
) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map((rp) => rp.permission.code),
  };
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  private async findActiveRole(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, ...NOT_DELETED },
      include: roleWithPermissions,
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      where: NOT_DELETED,
      orderBy: { name: 'asc' },
      include: roleWithPermissions,
    });
    return roles.map(toRoleDto);
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async createRole(dto: CreateRoleDto) {
    const code = normalizeRoleCode(dto.name);
    const existing = await this.prisma.role.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException(`Role code "${code}" already exists`);
    }

    const permissionCodes = dto.permissionCodes ?? [];
    const perms =
      permissionCodes.length > 0
        ? await this.prisma.permission.findMany({
            where: { code: { in: permissionCodes } },
          })
        : [];

    if (permissionCodes.length > 0 && perms.length !== permissionCodes.length) {
      throw new BadRequestException('One or more permission codes are invalid');
    }

    const role = await this.prisma.role.create({
      data: {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isSystem: false,
        ...(perms.length > 0
          ? {
              permissions: {
                create: perms.map((p) => ({ permissionId: p.id })),
              },
            }
          : {}),
      },
      include: roleWithPermissions,
    });

    return toRoleDto(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.findActiveRole(id);

    if (dto.name === undefined && dto.description === undefined) {
      return toRoleDto(role);
    }

    let code = role.code;
    let name = role.name;

    if (dto.name !== undefined) {
      name = dto.name.trim();
      if (!role.isSystem) {
        code = normalizeRoleCode(name);
        if (code !== role.code) {
          const conflict = await this.prisma.role.findUnique({
            where: { code },
          });
          if (conflict && conflict.id !== role.id) {
            throw new ConflictException(`Role code "${code}" already exists`);
          }
        }
      }
    }

    const description =
      dto.description === undefined
        ? role.description
        : dto.description === null
          ? null
          : dto.description.trim() || null;

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name,
        code: role.isSystem ? role.code : code,
        description,
      },
      include: roleWithPermissions,
    });

    return toRoleDto(updated);
  }

  async softDelete(id: string) {
    const role = await this.findActiveRole(id);

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    const userCount = await this.prisma.user.count({
      where: { roleId: id, deletedAt: null },
    });
    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete role: ${userCount} active user(s) still assigned`,
      );
    }

    const deleted = await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: roleWithPermissions,
    });

    return toRoleDto(deleted);
  }

  async setRolePermissions(roleId: string, permissionCodes: string[]) {
    await this.findActiveRole(roleId);

    const perms = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
        skipDuplicates: true,
      }),
    ]);

    const updated = await this.findActiveRole(roleId);
    return toRoleDto(updated);
  }
}
