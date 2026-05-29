-- Only ADMIN remains a protected system role
UPDATE "Role" SET "isSystem" = true WHERE "code" = 'ADMIN';
UPDATE "Role" SET "isSystem" = false WHERE "code" IN ('PROJECT_MANAGER', 'DEVELOPER');
