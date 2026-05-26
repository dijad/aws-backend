import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification } from '@prisma/client';
import { Resend } from 'resend';
import {
  buildNotificationEmailContent,
  renderNotificationEmailHtml,
} from './notification-email';

/** Resend expects `Name <email@verified-domain.com>` or a verified bare address. */
export function normalizeEmailFrom(raw: string | undefined): string {
  const fallback = 'AWS <onboarding@resend.dev>';
  if (!raw?.trim()) return fallback;
  const value = raw.trim();
  if (value.includes('<') && value.includes('>')) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return `AWS <${value}>`;
  }
  return value;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly enabled: boolean;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.enabled =
      this.config.get<string>('EMAIL_ENABLED', 'true') !== 'false' && !!apiKey;
    this.from = normalizeEmailFrom(this.config.get<string>('EMAIL_FROM'));
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ??
      this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  onModuleInit() {
    if (this.enabled) {
      this.logger.log(
        `Resend email delivery enabled (from: ${this.from}, links: ${this.frontendUrl})`,
      );
      return;
    }
    this.logger.warn(
      'Email delivery disabled — set RESEND_API_KEY and EMAIL_ENABLED=true in .env',
    );
  }

  async sendForNotifications(
    notifications: Notification[],
    usersById: Map<string, { email: string; name: string }>,
    referenceTitles: Map<string, string> = new Map(),
  ): Promise<void> {
    const resend = this.resend;
    if (!this.enabled || !resend || notifications.length === 0) return;

    const results = await Promise.allSettled(
      notifications.map(async (notification) => {
        const user = usersById.get(notification.userId);
        if (!user?.email) {
          this.logger.warn(
            `Skipping email for notification ${notification.id}: user ${notification.userId} has no email`,
          );
          return;
        }

        const refKey = `${notification.referenceType}:${notification.referenceId}`;
        const content = buildNotificationEmailContent({
          type: notification.type,
          message: notification.message,
          referenceId: notification.referenceId,
          referenceType: notification.referenceType,
          referenceTitle: referenceTitles.get(refKey),
          frontendUrl: this.frontendUrl,
          userName: user.name,
        });

        const { data, error } = await resend.emails.send({
          from: this.from,
          to: user.email,
          subject: content.subject,
          html: renderNotificationEmailHtml(content),
          text: [
            content.heading,
            '',
            `${content.referenceLabel}: ${content.referenceTitle}`,
            content.actionUrl,
            '',
            notification.message,
            '',
            `${content.actionLabel}: ${content.actionUrl}`,
          ].join('\n'),
        });

        if (error) {
          throw new Error(
            `Resend failed for ${user.email} (${notification.type}): ${error.message}`,
          );
        }

        this.logger.debug(
          `Email sent to ${user.email} (${notification.type}) id=${data?.id ?? '—'}`,
        );
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      for (const r of failed) {
        if (r.status === 'rejected') {
          this.logger.error(r.reason);
        }
      }
      this.logger.warn(
        `${failed.length}/${notifications.length} notification email(s) failed`,
      );
    }
  }
}
