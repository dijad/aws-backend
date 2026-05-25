import { Injectable } from '@nestjs/common';
import {
  Notification,
  NotificationReferenceType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsGateway } from './notifications.gateway';
import { NoteSyncOptions, NoteSyncPayload } from './note-sync.types';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  message: string;
  referenceId: string;
  referenceType: NotificationReferenceType;
}

export type CreateNotificationInputWithSync = CreateNotificationInput & {
  noteSync?: NoteSyncOptions;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly email: EmailService,
  ) {}

  async createMany(
    items: CreateNotificationInputWithSync[],
  ): Promise<Notification[]> {
    if (items.length === 0) return [];
    const created = await this.prisma.$transaction(
      items.map(({ noteSync: _, ...n }) => this.prisma.notification.create({ data: n })),
    );
    for (let i = 0; i < created.length; i++) {
      const n = created[i];
      this.gateway.emitToUser(n.userId, 'notification:new', n);
      const sync = items[i].noteSync;
      if (sync) {
        this.emitNoteSync(n.userId, sync);
      }
    }
    void this.dispatchEmails(created);
    return created;
  }

  emitNoteSync(userId: string, options: NoteSyncOptions) {
    const payload: NoteSyncPayload = {
      note: options.note,
      add: options.add ?? [],
      remove: options.remove ?? [],
    };
    if (payload.add.length === 0 && payload.remove.length === 0) return;
    this.gateway.emitToUser(userId, 'note:sync', payload);
  }

  list(userId: string, params: { onlyUnread?: boolean; take?: number } = {}) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(params.onlyUnread ? { isRead: false } : {}),
    };
    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  private async findUsersWithPermission(
    permissionCode: string,
    options?: { excludeUserIds?: string[] },
  ) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(options?.excludeUserIds?.length
          ? { id: { notIn: options.excludeUserIds } }
          : {}),
        role: {
          permissions: {
            some: { permission: { code: permissionCode } },
          },
        },
      },
      select: { id: true },
    });
  }

  /** Real-time list sync for every user with a permission (e.g. approvers). */
  async broadcastNoteSyncToUsersWithPermission(
    permissionCode: string,
    sync: NoteSyncOptions,
    options?: { excludeUserIds?: string[] },
  ) {
    const users = await this.findUsersWithPermission(permissionCode, options);
    for (const u of users) {
      this.emitNoteSync(u.id, sync);
    }
  }

  /**
   * Notify active users whose role has a given permission.
   */
  async notifyUsersWithPermission(
    permissionCode: string,
    payload: Omit<CreateNotificationInput, 'userId'>,
    options?: {
      excludeUserIds?: string[];
      noteSync?: NoteSyncOptions;
    },
  ) {
    const users = await this.findUsersWithPermission(permissionCode, options);
    if (users.length === 0) return [];
    return this.createMany(
      users.map((u) => ({
        ...payload,
        userId: u.id,
        ...(options?.noteSync ? { noteSync: options.noteSync } : {}),
      })),
    );
  }

  /**
   * Notify a list of role codes (used to ping all admins/devs about new
   * system updates).
   */
  async notifyRoles(
    roleCodes: string[],
    payload: Omit<CreateNotificationInput, 'userId'>,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { code: { in: roleCodes } },
      },
      select: { id: true },
    });
    if (users.length === 0) return [];
    return this.createMany(users.map((u) => ({ ...payload, userId: u.id })));
  }

  private async dispatchEmails(notifications: Notification[]) {
    const userIds = [...new Set(notifications.map((n) => n.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, deletedAt: null, isActive: true },
      select: { id: true, email: true, name: true },
    });
    const usersById = new Map(
      users.map((u) => [u.id, { email: u.email, name: u.name }]),
    );
    await this.email.sendForNotifications(notifications, usersById);
  }
}
