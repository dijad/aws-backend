import { AuthUser } from '../common/types/auth-user.type';

/** ADMIN role and NOTE_SKIP_APPROVAL publish notes without the approval queue. */
export function skipsNoteApproval(user: AuthUser): boolean {
  return (
    user.roleCode === 'ADMIN' ||
    user.permissions.includes('NOTE_SKIP_APPROVAL')
  );
}
