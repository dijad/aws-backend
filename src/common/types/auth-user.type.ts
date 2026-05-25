export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleCode: string;
  permissions: string[];
}
