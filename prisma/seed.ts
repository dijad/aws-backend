import { config } from 'dotenv';
import { resolve } from 'path';
import { FeatureDocumentStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { closeCloudSqlConnector, initCloudSqlConnector } from '../src/config/cloud-sql';
import { isCloudSqlTarget } from '../src/config/db-config';
import { ensureDatabaseUrl } from '../src/config/database-url';
import { GLOBAL_NOTES_MANUAL_DOCS } from './manual-content';

config({ path: resolve(__dirname, '../.env') });

async function createPrismaClient(): Promise<PrismaClient> {
  if (isCloudSqlTarget()) {
    const adapter = await initCloudSqlConnector();
    return new PrismaClient({ adapter });
  }
  ensureDatabaseUrl();
  return new PrismaClient();
}

const ROLES = [
  { code: 'ADMIN', name: 'Administrator', description: 'Full access' },
  {
    code: 'PROJECT_MANAGER',
    name: 'Project Manager',
    description: 'Creates notes and system updates',
  },
  {
    code: 'DEVELOPER',
    name: 'Developer',
    description: 'Reviews system updates and edits the manual',
  },
];

const PERMISSIONS = [
  { code: 'USER_CREATE', description: 'Create users' },
  { code: 'USER_UPDATE', description: 'Update users' },
  { code: 'USER_DELETE', description: 'Delete users (logical)' },
  { code: 'ROLE_MANAGE', description: 'Manage roles and assign permissions' },
  { code: 'MODULE_MANAGE', description: 'CRUD modules / categories' },
  { code: 'NOTE_CREATE', description: 'Create notes' },
  { code: 'NOTE_SKIP_APPROVAL', description: 'Publish notes without approval' },
  { code: 'NOTE_APPROVE_REJECT', description: 'Approve or reject notes' },
  { code: 'NOTE_DELETE', description: 'Delete notes (logical)' },
  { code: 'SYSTEM_UPDATE_CREATE', description: 'Create system update requests' },
  {
    code: 'SYSTEM_UPDATE_REVIEW_AS_DEV',
    description: 'Review system updates as developer',
  },
  {
    code: 'SYSTEM_UPDATE_REVIEW_AS_ADMIN',
    description: 'Review system updates as administrator',
  },
  {
    code: 'SYSTEM_UPDATE_DELETE',
    description: 'Delete system update requests (logical)',
  },
  { code: 'MANUAL_EDIT', description: 'Create and edit feature documents' },
  { code: 'MANUAL_PUBLISH', description: 'Publish feature documents' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.code),
  PROJECT_MANAGER: ['NOTE_CREATE', 'SYSTEM_UPDATE_CREATE'],
  DEVELOPER: [
    'NOTE_CREATE',
    'SYSTEM_UPDATE_CREATE',
    'SYSTEM_UPDATE_REVIEW_AS_DEV',
    'MANUAL_EDIT',
  ],
};

const LEGACY_MODULE_SLUGS = ['jobs', 'schedule', 'quote', 'inventory', 'reporting'];

const REMOVED_MANUAL_DOC_SLUGS = [
  'roles-and-permissions',
  'notifications-and-admin',
  'user-manual',
];

const MODULES = [
  {
    name: 'Global Notes',
    slug: 'global-notes',
    description:
      'Internal notes, approvals, system update requests, and workspace documentation',
    order: 1,
  },
];

async function runSeed(prisma: PrismaClient) {
  // eslint-disable-next-line no-console
  console.log('Seeding database...');

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: { ...role, isSystem: true },
    });
  }

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;
    const perms = await prisma.permission.findMany({
      where: { code: { in: permCodes } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  for (const slug of LEGACY_MODULE_SLUGS) {
    await prisma.module.updateMany({
      where: { slug },
      data: { isActive: false },
    });
  }

  for (const mod of MODULES) {
    await prisma.module.upsert({
      where: { slug: mod.slug },
      update: {
        name: mod.name,
        description: mod.description,
        order: mod.order,
        isActive: true,
      },
      create: { ...mod, isActive: true },
    });
  }

  const adminRole = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (!adminRole) throw new Error('ADMIN role missing after seeding.');

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const name = process.env.SEED_ADMIN_NAME ?? 'Administrator';
  const passwordHash = await bcrypt.hash(password, 10);

  const adminUser = await prisma.user.upsert({
    where: { email },
    update: { name, roleId: adminRole.id, isActive: true, deletedAt: null },
    create: {
      email,
      name,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  const globalNotesModule = await prisma.module.findUnique({
    where: { slug: 'global-notes' },
  });
  if (globalNotesModule) {
    await prisma.featureDocument.deleteMany({
      where: {
        moduleId: globalNotesModule.id,
        slug: { in: REMOVED_MANUAL_DOC_SLUGS },
      },
    });

    const publishedAt = new Date();
    for (const manualDoc of GLOBAL_NOTES_MANUAL_DOCS) {
      await prisma.featureDocument.upsert({
        where: {
          moduleId_slug: {
            moduleId: globalNotesModule.id,
            slug: manualDoc.slug,
          },
        },
        update: {
          title: manualDoc.title,
          contentJson: manualDoc.contentJson as object,
          contentText: manualDoc.contentText,
          status: FeatureDocumentStatus.PUBLISHED,
          publishedAt,
        },
        create: {
          moduleId: globalNotesModule.id,
          authorId: adminUser.id,
          title: manualDoc.title,
          slug: manualDoc.slug,
          contentJson: manualDoc.contentJson as object,
          contentText: manualDoc.contentText,
          status: FeatureDocumentStatus.PUBLISHED,
          publishedAt,
        },
      });
    }
    // eslint-disable-next-line no-console
    console.log(
      `User manual: ${GLOBAL_NOTES_MANUAL_DOCS.length} documents under Global Notes`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Admin seeded: ${email} / ${password}`);
}

async function main() {
  const prisma = await createPrismaClient();
  try {
    await runSeed(prisma);
  } finally {
    await prisma.$disconnect();
    if (isCloudSqlTarget()) {
      await closeCloudSqlConnector();
    }
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
