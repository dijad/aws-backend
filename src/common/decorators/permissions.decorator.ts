import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Marks a route as requiring one or more permissions. The PermissionsGuard
 * checks that the authenticated user has *all* listed permission codes.
 */
export const Permissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);
