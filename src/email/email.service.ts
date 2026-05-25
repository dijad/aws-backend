import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Notification } from '@prisma/client';
import { Resend } from 'resend';
import {
  buildNotificationEmailContent,
  renderNotificationEmailHtml,
} from './notification-email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly enabled: boolean;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.enabled =
      this.config.get<string>('EMAIL_ENABLED', 'true') !== 'false' && !!apiKey;
    this.from =
      this.config.get<string>('EMAIL_FROM') ?? 'Global Notes <onboarding@resend.dev>';
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ??
      this.config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.enabled) {
      this.logger.warn(
        'Email delivery disabled (set RESEND_API_KEY and EMAIL_ENABLED=true to enable)',
      );
    }
  }

  async sendForNotifications(
    notifications: Notification[],
    usersById: Map<string, { email: string; name: string }>,
  ): Promise<void> {
    const resend = this.resend;
    if (!this.enabled || !resend || notifications.length === 0) return;

    await Promise.all(
      notifications.map(async (notification) => {
        const user = usersById.get(notification.userId);
        if (!user?.email) return;

        try {
          const content = buildNotificationEmailContent({
            type: notification.type,
            message: notification.message,
            referenceId: notification.referenceId,
            referenceType: notification.referenceType,
            frontendUrl: this.frontendUrl,
            userName: user.name,
          });

          const { error } = await resend.emails.send({
            from: this.from,
            to: user.email,
            subject: content.subject,
            html: renderNotificationEmailHtml(content),
            text: `${content.heading}\n\n${notification.message}\n\n${content.actionLabel}: ${content.actionUrl}`,
          });

          if (error) {
            this.logger.error(
              `Resend failed for ${user.email} (${notification.type}): ${error.message}`,
            );
          }
        } catch (err) {
          this.logger.error(
            `Email send error for user ${notification.userId}`,
            err instanceof Error ? err.stack : err,
          );
        }
      }),
    );
  }
}
