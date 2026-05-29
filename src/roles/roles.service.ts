import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';

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

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.code),
    }));
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
      include: { permissions: { include: { permission: true } } },
    });

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.permissions.map((rp) => rp.permission.code),
    };
  }

  async setRolePermissions(roleId: string, permissionCodes: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');

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

    return this.listRoles().then((roles) =>
      roles.find((r) => r.id === roleId),
    );
  }
}
