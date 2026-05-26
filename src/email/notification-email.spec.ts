import { NotificationReferenceType, NotificationType } from '@prisma/client';
import { normalizeEmailFrom } from './email.service';
import {
  buildNotificationEmailContent,
  referenceDetailUrl,
} from './notification-email';

describe('normalizeEmailFrom', () => {
  it('wraps bare email addresses', () => {
    expect(normalizeEmailFrom('team@example.com')).toBe(
      'AWS <team@example.com>',
    );
  });
});

describe('referenceDetailUrl', () => {
  it('links to a specific note', () => {
    expect(
      referenceDetailUrl(
        'http://localhost:3000',
        NotificationReferenceType.NOTE,
        'note-1',
      ),
    ).toBe('http://localhost:3000/global-notes/note-1');
  });

  it('links to a specific system update', () => {
    expect(
      referenceDetailUrl(
        'http://localhost:3000',
        NotificationReferenceType.SYSTEM_UPDATE,
        'su-1',
      ),
    ).toBe('http://localhost:3000/global-notes/system-updates/su-1');
  });
});

describe('buildNotificationEmailContent', () => {
  const base = {
    message: 'Nueva nota pendiente: "Mi título"',
    referenceId: 'abc123',
    frontendUrl: 'http://localhost:3000',
    userName: 'Diego',
  };

  it('uses direct note URL for pending approval', () => {
    const content = buildNotificationEmailContent({
      ...base,
      type: NotificationType.NOTE_PENDING,
      referenceType: NotificationReferenceType.NOTE,
      referenceTitle: 'Mi título',
    });
    expect(content.actionUrl).toBe('http://localhost:3000/global-notes/abc123');
    expect(content.referenceTitle).toBe('Mi título');
    expect(content.subject).toContain('Mi título');
  });

  it('uses direct request URL for new system updates', () => {
    const content = buildNotificationEmailContent({
      ...base,
      message: 'Nueva solicitud: "Fix login"',
      type: NotificationType.SYSTEM_UPDATE_NEW,
      referenceType: NotificationReferenceType.SYSTEM_UPDATE,
      referenceTitle: 'Fix login',
    });
    expect(content.actionUrl).toBe(
      'http://localhost:3000/global-notes/system-updates/abc123',
    );
    expect(content.referenceTitle).toBe('Fix login');
  });

  it('extracts title from quoted message when referenceTitle is missing', () => {
    const content = buildNotificationEmailContent({
      ...base,
      type: NotificationType.NOTE_MENTION,
      referenceType: NotificationReferenceType.NOTE,
    });
    expect(content.referenceTitle).toBe('Mi título');
  });
});
