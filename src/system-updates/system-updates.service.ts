import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationReferenceType,
  NotificationType,
  Prisma,
  SystemUpdateCommentType,
  SystemUpdateStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/types/auth-user.type';
import {
  CreateSystemUpdateDto,
  ListSystemUpdatesQueryDto,
  ReviewDecisionDto,
  SystemUpdateCommentDto,
} from './dto/system-update.dto';

const SU_INCLUDE = {
  requester: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  module: { select: { id: true, name: true, slug: true } },
  devReviewedBy: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  adminReviewedBy: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  comments: {
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.SystemUpdateInclude;

const NOT_DELETED = { deletedAt: null } as const;

@Injectable()
export class SystemUpdatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, query: ListSystemUpdatesQueryDto) {
    const isDev = user.permissions.includes('SYSTEM_UPDATE_REVIEW_AS_DEV');
    const isAdmin = user.permissions.includes('SYSTEM_UPDATE_REVIEW_AS_ADMIN');

    const where: Prisma.SystemUpdateWhereInput = (() => {
      const base = NOT_DELETED;
      switch (query.scope) {
        case 'mine':
          return { ...base, requesterId: user.id };
        case 'inbox':
          if (isAdmin)
            return { ...base, status: { in: ['PENDING', 'DEV_APPROVED'] } };
          if (isDev) return { ...base, status: 'PENDING' };
          throw new ForbiddenException();
        case 'pending':
          if (!(isAdmin || isDev)) throw new ForbiddenException();
          return { ...base, status: 'PENDING' };
        case 'approved':
          return { ...base, status: 'ADMIN_APPROVED' };
        case 'completed':
          return { ...base, status: 'COMPLETED' };
        case 'rejected':
          return {
            ...base,
            status: { in: ['DEV_REJECTED', 'ADMIN_REJECTED'] },
          };
        case 'all':
          if (!(isAdmin || isDev)) throw new ForbiddenException();
          return base;
        default:
          if (isAdmin || isDev) return base;
          return { ...base, requesterId: user.id };
      }
    })();

    return this.prisma.systemUpdate.findMany({
      where,
      include: SU_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async byId(id: string) {
    const su = await this.prisma.systemUpdate.findFirst({
      where: { id, ...NOT_DELETED },
      include: SU_INCLUDE,
    });
    if (!su) throw new NotFoundException('System update not found');
    return su;
  }

  async create(requesterId: string, dto: CreateSystemUpdateDto) {
    const mod = await this.prisma.module.findUnique({
      where: { id: dto.moduleId },
    });
    if (!mod || !mod.isActive) {
      throw new BadRequestException('Invalid or inactive module');
    }

    const created = await this.prisma.systemUpdate.create({
      data: {
        requesterId,
        moduleId: dto.moduleId,
        type: dto.type,
        priority: dto.priority,
        title: dto.title,
        description: dto.description,
      },
      include: SU_INCLUDE,
    });

    await this.notifications.notifyRoles(
      ['ADMIN', 'DEVELOPER'],
      {
        type: NotificationType.SYSTEM_UPDATE_NEW,
        message: `Nueva solicitud (${dto.type === 'BUG_FIX' ? 'Bug Fix' : 'Enhancement'}): ${dto.title}`,
        referenceId: created.id,
        referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      },
      { excludeUserIds: [requesterId] },
    );

    return created;
  }

  async devReview(reviewerId: string, id: string, dto: ReviewDecisionDto) {
    const su = await this.prisma.systemUpdate.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!su) throw new NotFoundException('System update not found');
    if (su.status !== 'PENDING') {
      throw new BadRequestException(
        'Dev review only allowed while status is PENDING',
      );
    }

    if (dto.approve) {
      const updated = await this.prisma.systemUpdate.update({
        where: { id },
        data: {
          status: SystemUpdateStatus.DEV_APPROVED,
          devReviewedById: reviewerId,
          devReviewedAt: new Date(),
        },
        include: SU_INCLUDE,
      });

      await this.notifications.notifyRoles(['ADMIN'], {
        type: NotificationType.SYSTEM_UPDATE_DEV_APPROVED,
        message: `Solicitud aprobada por Dev, pendiente de Admin: ${su.title}`,
        referenceId: su.id,
        referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      });
      await this.notifications.createMany([
        {
          userId: su.requesterId,
          type: NotificationType.SYSTEM_UPDATE_DEV_APPROVED,
          message: `Tu solicitud "${su.title}" fue aprobada por un Developer y está pendiente de Admin`,
          referenceId: su.id,
          referenceType: NotificationReferenceType.SYSTEM_UPDATE,
        },
      ]);
      return updated;
    }

    if (!dto.reason) {
      throw new BadRequestException('A reason is required to reject');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.systemUpdate.update({
        where: { id },
        data: {
          status: SystemUpdateStatus.DEV_REJECTED,
          devReviewedById: reviewerId,
          devReviewedAt: new Date(),
        },
        include: SU_INCLUDE,
      }),
      this.prisma.systemUpdateComment.create({
        data: {
          systemUpdateId: id,
          authorId: reviewerId,
          content: dto.reason,
          type: SystemUpdateCommentType.REJECTION_REASON,
        },
      }),
    ]);

    await this.notifications.createMany([
      {
        userId: su.requesterId,
        type: NotificationType.SYSTEM_UPDATE_DEV_REJECTED,
        message: `Tu solicitud "${su.title}" fue rechazada por un Developer`,
        referenceId: su.id,
        referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      },
    ]);

    return updated;
  }

  async adminReview(reviewerId: string, id: string, dto: ReviewDecisionDto) {
    const su = await this.prisma.systemUpdate.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!su) throw new NotFoundException('System update not found');
    if (!['PENDING', 'DEV_APPROVED'].includes(su.status)) {
      throw new BadRequestException(
        'Admin review only allowed while status is PENDING or DEV_APPROVED',
      );
    }

    if (dto.approve) {
      const updated = await this.prisma.systemUpdate.update({
        where: { id },
        data: {
          status: SystemUpdateStatus.ADMIN_APPROVED,
          adminReviewedById: reviewerId,
          adminReviewedAt: new Date(),
        },
        include: SU_INCLUDE,
      });

      // Inform requester
      await this.notifications.createMany([
        {
          userId: su.requesterId,
          type: NotificationType.SYSTEM_UPDATE_ADMIN_APPROVED,
          message: `Tu solicitud "${su.title}" fue aprobada`,
          referenceId: su.id,
          referenceType: NotificationReferenceType.SYSTEM_UPDATE,
        },
      ]);
      // Ping developers about new work in their tray
      await this.notifications.notifyRoles(['DEVELOPER'], {
        type: NotificationType.SYSTEM_UPDATE_ADMIN_APPROVED,
        message: `Solicitud aprobada disponible para desarrollo: ${su.title}`,
        referenceId: su.id,
        referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      });
      return updated;
    }

    if (!dto.reason) {
      throw new BadRequestException('A reason is required to reject');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.systemUpdate.update({
        where: { id },
        data: {
          status: SystemUpdateStatus.ADMIN_REJECTED,
          adminReviewedById: reviewerId,
          adminReviewedAt: new Date(),
        },
        include: SU_INCLUDE,
      }),
      this.prisma.systemUpdateComment.create({
        data: {
          systemUpdateId: id,
          authorId: reviewerId,
          content: dto.reason,
          type: SystemUpdateCommentType.REJECTION_REASON,
        },
      }),
    ]);

    await this.notifications.createMany([
      {
        userId: su.requesterId,
        type: NotificationType.SYSTEM_UPDATE_ADMIN_REJECTED,
        message: `Tu solicitud "${su.title}" fue rechazada por Admin`,
        referenceId: su.id,
        referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      },
    ]);

    return updated;
  }

  async complete(reviewerId: string, id: string) {
    const su = await this.prisma.systemUpdate.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!su) throw new NotFoundException('System update not found');
    if (su.status !== 'ADMIN_APPROVED') {
      throw new BadRequestException(
        'Only ADMIN_APPROVED system updates can be marked as completed',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.systemUpdate.update({
        where: { id },
        data: {
          status: SystemUpdateStatus.COMPLETED,
          completedAt: new Date(),
        },
        include: SU_INCLUDE,
      });

      await tx.changelogEntry.create({
        data: {
          moduleId: su.moduleId,
          systemUpdateId: su.id,
          title: su.title,
          summary:
            (su.type === 'BUG_FIX' ? '[Fix] ' : '[Enhancement] ') +
            su.description.slice(0, 280),
        },
      });
      return upd;
    });

    await this.notifications.createMany([
      {
        userId: su.requesterId,
        type: NotificationType.SYSTEM_UPDATE_COMPLETED,
        message: `Tu solicitud "${su.title}" fue completada`,
        referenceId: su.id,
        referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      },
    ]);
    return updated;
  }

  async addComment(
    user: AuthUser,
    id: string,
    dto: SystemUpdateCommentDto,
  ) {
    const su = await this.prisma.systemUpdate.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!su) throw new NotFoundException('System update not found');
    return this.prisma.systemUpdateComment.create({
      data: {
        systemUpdateId: id,
        authorId: user.id,
        content: dto.content,
        type: SystemUpdateCommentType.COMMENT,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async softDelete(id: string) {
    const su = await this.prisma.systemUpdate.findFirst({
      where: { id, ...NOT_DELETED },
    });
    if (!su) throw new NotFoundException('System update not found');

    return this.prisma.systemUpdate.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: SU_INCLUDE,
    });
  }
}
