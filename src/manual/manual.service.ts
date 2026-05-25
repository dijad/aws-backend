import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeatureDocumentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFeatureDocumentDto,
  UpdateFeatureDocumentDto,
} from './dto/manual.dto';

const DOC_INCLUDE = {
  module: { select: { id: true, name: true, slug: true } },
  author: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.FeatureDocumentInclude;

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class ManualService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveModule(idOrSlug: string) {
    const mod = await this.prisma.module.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!mod) throw new NotFoundException('Module not found');
    return mod;
  }

  async listDocs(moduleIdOrSlug: string, includeDrafts = false) {
    const mod = await this.resolveModule(moduleIdOrSlug);
    return this.prisma.featureDocument.findMany({
      where: {
        moduleId: mod.id,
        ...(includeDrafts ? {} : { status: 'PUBLISHED' }),
      },
      include: DOC_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDoc(moduleIdOrSlug: string, docSlug: string) {
    const mod = await this.resolveModule(moduleIdOrSlug);
    const doc = await this.prisma.featureDocument.findUnique({
      where: { moduleId_slug: { moduleId: mod.id, slug: docSlug } },
      include: DOC_INCLUDE,
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async createDoc(
    authorId: string,
    moduleIdOrSlug: string,
    dto: CreateFeatureDocumentDto,
  ) {
    const mod = await this.resolveModule(moduleIdOrSlug);
    const slug = dto.slug ?? slugify(dto.title);
    const exists = await this.prisma.featureDocument.findUnique({
      where: { moduleId_slug: { moduleId: mod.id, slug } },
    });
    if (exists)
      throw new ConflictException('A document with this slug already exists');

    return this.prisma.featureDocument.create({
      data: {
        moduleId: mod.id,
        authorId,
        title: dto.title,
        slug,
        contentJson: dto.contentJson as Prisma.InputJsonValue,
        contentText: dto.contentText,
        status: FeatureDocumentStatus.DRAFT,
      },
      include: DOC_INCLUDE,
    });
  }

  async updateDoc(id: string, dto: UpdateFeatureDocumentDto) {
    const doc = await this.prisma.featureDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.featureDocument.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        contentJson:
          (dto.contentJson as Prisma.InputJsonValue | undefined) ?? undefined,
        contentText: dto.contentText ?? undefined,
      },
      include: DOC_INCLUDE,
    });
  }

  async publishDoc(id: string) {
    const doc = await this.prisma.featureDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.featureDocument.update({
      where: { id },
      data: {
        status: FeatureDocumentStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: DOC_INCLUDE,
    });
  }

  async unpublishDoc(id: string) {
    const doc = await this.prisma.featureDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.featureDocument.update({
      where: { id },
      data: { status: FeatureDocumentStatus.DRAFT },
      include: DOC_INCLUDE,
    });
  }

  async listChangelog(moduleIdOrSlug: string) {
    const mod = await this.resolveModule(moduleIdOrSlug);
    return this.prisma.changelogEntry.findMany({
      where: { moduleId: mod.id },
      orderBy: { releasedAt: 'desc' },
    });
  }

  async search(term: string) {
    const q = term.trim();
    if (q.length < 2) return [];
    return this.prisma.featureDocument.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { contentText: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: DOC_INCLUDE,
      take: 20,
    });
  }
}
