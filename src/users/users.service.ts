import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  isActive: true,
  deletedAt: true,
  roleId: true,
  role: { select: { id: true, code: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(includeDeleted = false) {
    return this.prisma.user.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      select: SAFE_USER_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async listActiveLite() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    });
  }

  async byId(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException('Email already in use');

    const role = await this.prisma.role.findUnique({
      where: { code: dto.roleCode },
    });
    if (!role) throw new NotFoundException('Role not found');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
        roleId: role.id,
        isActive: true,
        avatarUrl: dto.avatarUrl ?? null,
      },
      select: SAFE_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    let roleId: string | undefined;
    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { code: dto.roleCode },
      });
      if (!role) throw new NotFoundException('Role not found');
      roleId = role.id;
    }

    let passwordHash: string | undefined;
    if (dto.password) passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        avatarUrl: dto.avatarUrl ?? undefined,
        isActive: dto.isActive ?? undefined,
        roleId,
        passwordHash,
      },
      select: SAFE_USER_SELECT,
    });
  }

  async softDelete(id: string, requesterId: string) {
    if (id === requesterId)
      throw new ForbiddenException('Cannot delete yourself');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
      select: SAFE_USER_SELECT,
    });
  }
}
