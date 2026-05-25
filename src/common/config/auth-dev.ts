import { AuthUser } from '../types/auth-user.type';

/** Bypass JWT/permisos cuando AUTH_DISABLED=true en .env (solo desarrollo). */
export const AUTH_DISABLED =
  process.env.AUTH_DISABLED === 'true' || process.env.AUTH_DISABLED === '1';

export const DEV_MOCK_USER: AuthUser = {
  id: 'dev-mock-user',
  email: 'dev@local',
  name: 'Modo desarrollo',
  roleCode: 'ADMIN',
  permissions: [
    'USER_CREATE',
    'USER_UPDATE',
    'USER_DELETE',
    'ROLE_MANAGE',
    'MODULE_MANAGE',
    'NOTE_CREATE',
    'NOTE_APPROVE_REJECT',
    'SYSTEM_UPDATE_CREATE',
    'SYSTEM_UPDATE_REVIEW_AS_DEV',
    'SYSTEM_UPDATE_REVIEW_AS_ADMIN',
    'MANUAL_EDIT',
    'MANUAL_PUBLISH',
  ],
};
