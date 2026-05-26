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
  const referenceLabel = isNote ? 'Nota' : 'Solicitud';
  const referenceTitle =
    params.referenceTitle?.trim() ||
    extractTitleFromMessage(params.message) ||
    (isNote ? 'Ver nota' : 'Ver solicitud');
  const appName = EMAIL_APP_NAME;

  const typeMeta: Record<
    NotificationType,
    { subject: string; heading: string; preview: string }
  > = {
    NOTE_PENDING: {
      subject: 'Nota pendiente de aprobación',
      heading: 'Nueva nota por revisar',
      preview: 'Hay una nota esperando tu aprobación o rechazo.',
    },
    NOTE_MENTION: {
      subject: 'Te etiquetaron en una nota',
      heading: 'Fuiste mencionado en una nota',
      preview: 'Alguien te etiquetó en una nota aprobada.',
    },
    NOTE_RECEIVED: {
      subject: 'Recibiste una nota',
      heading: 'Tienes una nota nueva',
      preview: 'Te enviaron una nota que ya fue aprobada.',
    },
    NOTE_APPROVED: {
      subject: 'Tu nota fue aprobada',
      heading: 'Nota aprobada',
      preview: 'Un revisor aprobó tu nota.',
    },
    NOTE_REJECTED: {
      subject: 'Tu nota fue rechazada',
      heading: 'Nota rechazada',
      preview: 'Un revisor rechazó tu nota.',
    },
    SYSTEM_UPDATE_NEW: {
      subject: 'Nueva solicitud de actualización',
      heading: 'Solicitud nueva por revisar',
      preview: 'Hay una solicitud de sistema que requiere atención.',
    },
    SYSTEM_UPDATE_DEV_APPROVED: {
      subject: 'Solicitud aprobada por Developer',
      heading: 'Aprobación de Developer',
      preview: 'Una solicitud avanzó en el flujo de aprobación.',
    },
    SYSTEM_UPDATE_DEV_REJECTED: {
      subject: 'Solicitud rechazada por Developer',
      heading: 'Rechazo de Developer',
      preview: 'Una solicitud fue rechazada en revisión de Developer.',
    },
    SYSTEM_UPDATE_ADMIN_APPROVED: {
      subject: 'Solicitud aprobada por Admin',
      heading: 'Aprobación de Admin',
      preview: 'Una solicitud fue aprobada o está lista para desarrollo.',
    },
    SYSTEM_UPDATE_ADMIN_REJECTED: {
      subject: 'Solicitud rechazada por Admin',
      heading: 'Rechazo de Admin',
      preview: 'Una solicitud fue rechazada por Admin.',
    },
    SYSTEM_UPDATE_COMPLETED: {
      subject: 'Solicitud completada',
      heading: 'Solicitud finalizada',
      preview: 'Tu solicitud de actualización fue marcada como completada.',
    },
  };

  const meta = typeMeta[params.type];
  const greeting = params.userName ? `Hola ${escapeHtml(params.userName)},` : 'Hola,';
  const actionLabel = isNote ? 'Abrir nota' : 'Abrir solicitud';

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
<html lang="es">
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
        Recibiste este correo porque tienes una notificación en ${escapeHtml(EMAIL_APP_TAGLINE)}.
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
