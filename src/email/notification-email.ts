import {
  NotificationReferenceType,
  NotificationType,
} from '@prisma/client';

export interface NotificationEmailContent {
  subject: string;
  preview: string;
  heading: string;
  bodyHtml: string;
  actionLabel: string;
  actionUrl: string;
}

export function buildNotificationEmailContent(params: {
  type: NotificationType;
  message: string;
  referenceId: string;
  referenceType: NotificationReferenceType;
  frontendUrl: string;
  userName: string;
}): NotificationEmailContent {
  const base = params.frontendUrl.replace(/\/$/, '');
  const isNote = params.referenceType === 'NOTE';
  const path = isNote
    ? `/global-notes/${params.referenceId}`
    : `/global-notes/system-updates/${params.referenceId}`;
  const actionUrl = `${base}${path}`;
  const appName = 'Global Notes';

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

  return {
    subject: `${meta.subject} · ${appName}`,
    preview: meta.preview,
    heading: meta.heading,
    actionLabel: isNote ? 'Ver nota' : 'Ver solicitud',
    actionUrl,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#334155;">${greeting}</p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155;">${escapeHtml(meta.preview)}</p>
      <p style="margin:0;padding:12px 14px;background:#f8fafc;border-radius:8px;font-size:14px;line-height:1.5;color:#0f172a;border:1px solid #e2e8f0;">${escapeHtml(params.message)}</p>
    `,
  };
}

export function renderNotificationEmailHtml(content: NotificationEmailContent): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr>
      <td style="background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">Global Notes</p>
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(content.heading)}</h1>
        ${content.bodyHtml}
        <p style="margin:24px 0 0;">
          <a href="${content.actionUrl}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(content.actionLabel)}</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 8px 0;text-align:center;font-size:12px;line-height:1.5;color:#64748b;">
        Recibiste este correo porque tienes una notificación en Global Notes.
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
