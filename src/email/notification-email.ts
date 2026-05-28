import {
  NotificationReferenceType,
  NotificationType,
} from '@prisma/client';

/** Aligned with frontend/assets/css/main.css (light theme). */
export const EMAIL_APP_NAME = 'AWS';
export const EMAIL_APP_TAGLINE = 'AWS Workspace';

const THEME = {
  bg: '#f8f9fb',
  surface: '#ffffff',
  inkStrong: '#1f2937',
  ink: '#374151',
  inkSoft: '#6b7280',
  inkFaint: '#9ca3af',
  accent: '#3b82f6',
  accentSoft: '#f0f6ff',
  border: '#e8eaed',
  shadow:
    '0 1px 3px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.025)',
} as const;

export interface NotificationEmailContent {
  subject: string;
  preview: string;
  heading: string;
  bodyHtml: string;
  actionLabel: string;
  actionUrl: string;
  referenceLabel: string;
  referenceTitle: string;
}

export function referenceDetailUrl(
  frontendUrl: string,
  referenceType: NotificationReferenceType,
  referenceId: string,
): string {
  const base = frontendUrl.replace(/\/$/, '');
  if (referenceType === 'NOTE') {
    return `${base}/global-notes/${referenceId}`;
  }
  return `${base}/global-notes/system-updates/${referenceId}`;
}

export function buildNotificationEmailContent(params: {
  type: NotificationType;
  message: string;
  referenceId: string;
  referenceType: NotificationReferenceType;
  referenceTitle?: string | null;
  frontendUrl: string;
  userName: string;
}): NotificationEmailContent {
  const isNote = params.referenceType === 'NOTE';
  const actionUrl = referenceDetailUrl(
    params.frontendUrl,
    params.referenceType,
    params.referenceId,
  );
  const referenceLabel = isNote ? 'Note' : 'Request';
  const referenceTitle =
    params.referenceTitle?.trim() ||
    extractTitleFromMessage(params.message) ||
    (isNote ? 'View note' : 'View request');
  const appName = EMAIL_APP_NAME;

  const typeMeta: Record<
    NotificationType,
    { subject: string; heading: string; preview: string }
  > = {
    NOTE_PENDING: {
      subject: 'Note pending approval',
      heading: 'New note to review',
      preview: 'A note is waiting for your approval or rejection.',
    },
    NOTE_MENTION: {
      subject: 'You were tagged in a note',
      heading: 'You were mentioned in a note',
      preview: 'Someone tagged you in an approved note.',
    },
    NOTE_RECEIVED: {
      subject: 'You received a note',
      heading: 'You have a new note',
      preview: 'You received a note that has already been approved.',
    },
    NOTE_APPROVED: {
      subject: 'Your note was approved',
      heading: 'Note approved',
      preview: 'A reviewer approved your note.',
    },
    NOTE_REJECTED: {
      subject: 'Your note was rejected',
      heading: 'Note rejected',
      preview: 'A reviewer rejected your note.',
    },
    SYSTEM_UPDATE_NEW: {
      subject: 'New system update request',
      heading: 'New request to review',
      preview: 'A system request needs your attention.',
    },
    SYSTEM_UPDATE_DEV_APPROVED: {
      subject: 'Request approved by Developer',
      heading: 'Developer approval',
      preview: 'A request moved forward in the approval flow.',
    },
    SYSTEM_UPDATE_DEV_REJECTED: {
      subject: 'Request rejected by Developer',
      heading: 'Developer rejection',
      preview: 'A request was rejected during Developer review.',
    },
    SYSTEM_UPDATE_ADMIN_APPROVED: {
      subject: 'Request approved by Admin',
      heading: 'Admin approval',
      preview: 'A request was approved and is ready for development.',
    },
    SYSTEM_UPDATE_ADMIN_REJECTED: {
      subject: 'Request rejected by Admin',
      heading: 'Admin rejection',
      preview: 'A request was rejected by Admin.',
    },
    SYSTEM_UPDATE_COMPLETED: {
      subject: 'Request completed',
      heading: 'Request completed',
      preview: 'Your system update request was marked as completed.',
    },
  };

  const meta = typeMeta[params.type];
  const greeting = params.userName ? `Hi ${escapeHtml(params.userName)},` : 'Hi,';
  const actionLabel = isNote ? 'Open note' : 'Open request';

  return {
    subject: `${meta.subject}: ${referenceTitle} · ${appName}`,
    preview: `${meta.preview} ${referenceTitle}`,
    heading: meta.heading,
    referenceLabel,
    referenceTitle,
    actionLabel,
    actionUrl,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${THEME.ink};">${greeting}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${THEME.ink};">${escapeHtml(meta.preview)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px;">
        <tr>
          <td style="padding:14px 16px;background:${THEME.accentSoft};border-radius:8px;border:1px solid ${THEME.border};">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${THEME.inkSoft};">${escapeHtml(referenceLabel)}</p>
            <a href="${escapeHtml(actionUrl)}" style="font-size:16px;font-weight:600;line-height:1.35;color:${THEME.accent};text-decoration:none;">${escapeHtml(referenceTitle)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;padding:12px 14px;background:${THEME.surface};border-radius:8px;font-size:14px;line-height:1.55;color:${THEME.inkSoft};border:1px solid ${THEME.border};">${escapeHtml(params.message)}</p>
    `,
  };
}

/** Fallback when DB title is unavailable — messages often quote the title. */
function extractTitleFromMessage(message: string): string | null {
  const quoted = message.match(/"([^"]+)"/);
  return quoted?.[1]?.trim() || null;
}

export function renderNotificationEmailHtml(content: NotificationEmailContent): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:${THEME.bg};font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="background:${THEME.surface};border-radius:12px;padding:28px 24px;border:1px solid ${THEME.border};box-shadow:${THEME.shadow};">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
          <tr>
            <td style="vertical-align:middle;padding-right:10px;">
              <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:6px;background:${THEME.accent};color:#ffffff;font-size:13px;font-weight:700;">A</span>
            </td>
            <td style="vertical-align:middle;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:${THEME.inkStrong};">${escapeHtml(EMAIL_APP_NAME)}</td>
          </tr>
        </table>
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;font-weight:700;color:${THEME.inkStrong};">${escapeHtml(content.heading)}</h1>
        ${content.bodyHtml}
        <p style="margin:24px 0 8px;">
          <a href="${escapeHtml(content.actionUrl)}" style="display:inline-block;padding:10px 18px;background:${THEME.accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(content.actionLabel)}</a>
        </p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:${THEME.inkFaint};word-break:break-all;">
          <a href="${escapeHtml(content.actionUrl)}" style="color:${THEME.accent};text-decoration:underline;">${escapeHtml(content.actionUrl)}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 8px 0;text-align:center;font-size:12px;line-height:1.5;color:${THEME.inkFaint};">
        You received this email because you have a notification in ${escapeHtml(EMAIL_APP_TAGLINE)}.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
