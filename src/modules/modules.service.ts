import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.module.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async byIdOrSlug(idOrSlug: string) {
    const mod = await this.prisma.module.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!mod) throw new NotFoundException('Module not found');
    return mod;
  }

  async create(dto: CreateModuleDto) {
    const exists = await this.prisma.module.findUnique({
      where: { slug: dto.slug },
    });
    if (exists) throw new ConflictException('Slug already in use');
    return this.prisma.module.create({ data: dto });
  }

  async update(id: string, dto: UpdateModuleDto) {
    const mod = await this.prisma.module.findUnique({ where: { id } });
    if (!mod) throw new NotFoundException('Module not found');

    if (dto.slug && dto.slug !== mod.slug) {
      const conflict = await this.prisma.module.findUnique({
        where: { slug: dto.slug },
      });
      if (conflict) throw new ConflictException('Slug already in use');
    }

    return this.prisma.module.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const mod = await this.prisma.module.findUnique({ where: { id } });
    if (!mod) throw new NotFoundException('Module not found');
    return this.prisma.module.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
