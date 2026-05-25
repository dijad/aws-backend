import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NoteStatus,
  NoteSubNoteType,
  NotificationReferenceType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationInputWithSync,
  NotificationsService,
} from '../notifications/notifications.service';
import { AuthUser } from '../common/types/auth-user.type';
import {
  CreateNoteDto,
  CreateSubNoteDto,
  ListNotesQueryDto,
  RejectNoteDto,
} from './dto/note.dto';
import { skipsNoteApproval } from './note-approval.util';

const NOTE_INCLUDE = {
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  reviewedBy: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  mentions: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
  recipients: {
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
  subNotes: {
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.NoteInclude;

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, query: ListNotesQueryDto) {
    const canApprove = user.permissions.includes('NOTE_APPROVE_REJECT');
    const where = this.buildListWhere(user, query, canApprove);

    return this.prisma.note.findMany({
      where,
      include: NOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildListWhere(
    user: AuthUser,
    query: ListNotesQueryDto,
    canApprove: boolean,
  ): Prisma.NoteWhereInput {
    switch (query.scope) {
      case 'mine':
        return { authorId: user.id };
      case 'mentions':
        return { status: 'APPROVED', mentions: { some: { userId: user.id } } };
      case 'received':
        return {
          status: 'APPROVED',
          recipients: { some: { userId: user.id } },
        };
      case 'pending':
        if (!canApprove) throw new ForbiddenException();
        return { status: 'PENDING' };
      case 'approved':
        if (!canApprove) throw new ForbiddenException();
        return { status: 'APPROVED' };
      case 'rejected':
        if (!canApprove) throw new ForbiddenException();
        return { status: 'REJECTED' };
      case 'all':
        if (!canApprove) throw new ForbiddenException();
        return {};
      default:
        return {
          OR: [
            { authorId: user.id },
            {
              status: 'APPROVED',
              mentions: { some: { userId: user.id } },
            },
            {
              status: 'APPROVED',
              recipients: { some: { userId: user.id } },
            },
          ],
        };
    }
  }

  async byId(user: AuthUser, id: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: NOTE_INCLUDE,
    });
    if (!note) throw new NotFoundException('Note not found');

    const canApprove = user.permissions.includes('NOTE_APPROVE_REJECT');
    const isAuthor = note.authorId === user.id;
    const isMention = note.mentions.some((m) => m.userId === user.id);
    const isRecipient = note.recipients.some((r) => r.userId === user.id);
    const isApproved = note.status === 'APPROVED';

    if (!isAuthor && !canApprove && !((isMention || isRecipient) && isApproved)) {
      throw new ForbiddenException('You cannot view this note');
    }
    return note;
  }

  private async dispatchApprovedNoteNotifications(
    note: {
      id: string;
      title: string;
      authorId: string;
      status: NoteStatus;
      mentions: { userId: string }[];
      recipients: { userId: string }[];
    } & Record<string, unknown>,
    options?: { notifyAuthorApproved?: boolean },
  ) {
    const mentionPayloads: CreateNotificationInputWithSync[] = note.mentions.map(
      (m) => ({
        userId: m.userId,
        type: NotificationType.NOTE_MENTION,
        message: `Has sido etiquetado en una nota: "${note.title}"`,
        referenceId: note.id,
        referenceType: NotificationReferenceType.NOTE,
        noteSync: { note, add: ['mentions' as const] },
      }),
    );

    const recipientPayloads: CreateNotificationInputWithSync[] = note.recipients
      .filter((r) => !note.mentions.some((m) => m.userId === r.userId))
      .map((r) => ({
        userId: r.userId,
        type: NotificationType.NOTE_RECEIVED,
        message: `Has recibido una nota: "${note.title}"`,
        referenceId: note.id,
        referenceType: NotificationReferenceType.NOTE,
        noteSync: { note, add: ['received' as const] },
      }));

    const payloads: CreateNotificationInputWithSync[] = [
      ...mentionPayloads,
      ...recipientPayloads,
    ];

    if (options?.notifyAuthorApproved) {
      payloads.push({
        userId: note.authorId,
        type: NotificationType.NOTE_APPROVED,
        message: `Tu nota "${note.title}" fue aprobada`,
        referenceId: note.id,
        referenceType: NotificationReferenceType.NOTE,
        noteSync: { note, add: ['mine'] },
      });
    }

    if (payloads.length > 0) {
      await this.notifications.createMany(payloads);
    }
  }

  async create(user: AuthUser, dto: CreateNoteDto) {
    const authorId = user.id;
    const autoApprove = skipsNoteApproval(user);
    if (dto.mentionUserIds.includes(authorId)) {
      throw new BadRequestException('You cannot mention yourself');
    }
    if (dto.recipientUserIds.includes(authorId)) {
      throw new BadRequestException('You cannot send the note to yourself');
    }
    const allUserIds = Array.from(
      new Set([...dto.mentionUserIds, ...dto.recipientUserIds]),
    );
    if (allUserIds.length > 0) {
      const found = await this.prisma.user.count({
        where: { id: { in: allUserIds }, deletedAt: null, isActive: true },
      });
      if (found !== allUserIds.length) {
        throw new BadRequestException(
          'Some mentioned/recipient users do not exist or are inactive',
        );
      }
    }

    const note = await this.prisma.note.create({
      data: {
        authorId,
        title: dto.title,
        contentJson: dto.contentJson as Prisma.InputJsonValue,
        contentText: dto.contentText,
        status: autoApprove ? NoteStatus.APPROVED : NoteStatus.PENDING,
        mentions: {
          create: dto.mentionUserIds.map((userId) => ({ userId })),
        },
        recipients: {
          create: dto.recipientUserIds.map((userId) => ({ userId })),
        },
      },
      include: NOTE_INCLUDE,
    });

    this.notifications.emitNoteSync(authorId, { note, add: ['mine'] });

    if (autoApprove) {
      await this.dispatchApprovedNoteNotifications(note);
    } else {
      await this.notifications.notifyUsersWithPermission(
        'NOTE_APPROVE_REJECT',
        {
          type: NotificationType.NOTE_PENDING,
          message: `Nueva nota pendiente de aprobación: "${note.title}"`,
          referenceId: note.id,
          referenceType: NotificationReferenceType.NOTE,
        },
        {
          excludeUserIds: [authorId],
          noteSync: { note, add: ['pending'] },
        },
      );
    }

    return note;
  }

  async approve(reviewerId: string, id: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: { mentions: true, recipients: true },
    });
    if (!note) throw new NotFoundException('Note not found');
    if (note.status !== 'PENDING')
      throw new BadRequestException('Note is not pending');

    const updated = await this.prisma.note.update({
      where: { id },
      data: {
        status: NoteStatus.APPROVED,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: NOTE_INCLUDE,
    });

    await this.dispatchApprovedNoteNotifications(updated, {
      notifyAuthorApproved: true,
    });
    await this.notifications.broadcastNoteSyncToUsersWithPermission(
      'NOTE_APPROVE_REJECT',
      { note: updated, add: ['approved'], remove: ['pending'] },
    );

    return updated;
  }

  async reject(reviewerId: string, id: string, dto: RejectNoteDto) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    if (note.status !== 'PENDING')
      throw new BadRequestException('Note is not pending');

    const [updated] = await this.prisma.$transaction([
      this.prisma.note.update({
        where: { id },
        data: {
          status: NoteStatus.REJECTED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: NOTE_INCLUDE,
      }),
      this.prisma.noteSubNote.create({
        data: {
          noteId: id,
          authorId: reviewerId,
          content: dto.reason,
          type: NoteSubNoteType.REJECTION_REASON,
        },
      }),
    ]);

    await this.notifications.createMany([
      {
        userId: note.authorId,
        type: NotificationType.NOTE_REJECTED,
        message: `Tu nota "${note.title}" fue rechazada`,
        referenceId: note.id,
        referenceType: NotificationReferenceType.NOTE,
        noteSync: { note: updated, add: ['mine'] },
      },
    ]);
    await this.notifications.broadcastNoteSyncToUsersWithPermission(
      'NOTE_APPROVE_REJECT',
      { note: updated, add: ['rejected'], remove: ['pending'] },
    );

    return updated;
  }

  async addSubNote(user: AuthUser, noteId: string, dto: CreateSubNoteDto) {
    const note = await this.prisma.note.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException('Note not found');

    const canApprove = user.permissions.includes('NOTE_APPROVE_REJECT');
    const isAuthor = note.authorId === user.id;
    if (!canApprove && !isAuthor) {
      throw new ForbiddenException('You cannot comment on this note');
    }

    return this.prisma.noteSubNote.create({
      data: {
        noteId,
        authorId: user.id,
        content: dto.content,
        type: NoteSubNoteType.COMMENT,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }
}
