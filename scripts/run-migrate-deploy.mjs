/**
 * Prisma migrate deploy against Cloud SQL (Cloud Build + container startup).
 * Requires: DB_TARGET=cloud-sql, CLOUD_SQL_CONNECTION_NAME, DB_USER, DB_PASSWORD, DB_NAME
 */
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Connector, IpAddressTypes } from '@google-cloud/cloud-sql-connector';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function resolveConnectionName() {
  const explicit = process.env.CLOUD_SQL_CONNECTION_NAME?.trim();
  if (explicit) return explicit;
  const project = required('GCP_PROJECT_ID');
  const region = required('GCP_REGION');
  const instance = required('CLOUD_SQL_INSTANCE');
  return `${project}:${region}:${instance}`;
}

function buildPostgresUrl({ user, password, database, schema, socketHost }) {
  const params = new URLSearchParams({ host: socketHost, schema: schema || 'public' });
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${encodeURIComponent(database)}?${params.toString()}`;
}

async function main() {
  const target = process.env.DB_TARGET?.trim().toLowerCase();
  const hasCloudSql =
    target === 'cloud-sql' ||
    target === 'cloudsql' ||
    Boolean(process.env.CLOUD_SQL_CONNECTION_NAME?.trim());

  if (!hasCloudSql) {
    console.log('DB_TARGET is not cloud-sql; skipping migrations.');
    return;
  }

  const user = process.env.DB_USER?.trim() || 'postgres';
  const password = required('DB_PASSWORD');
  const database = process.env.DB_NAME?.trim() || 'aws';
  const schema = process.env.DB_SCHEMA?.trim() || 'public';
  const instanceConnectionName = resolveConnectionName();

  const socketDir =
    process.env.CLOUD_SQL_SOCKET_DIR?.trim() ||
    join(process.cwd(), '.cloud-sql-migrate');
  const socketPath = join(socketDir, '.s.PGSQL.5432');
  await mkdir(socketDir, { recursive: true });

  const ipType =
    process.env.CLOUD_SQL_IP_TYPE?.trim().toUpperCase() === 'PRIVATE'
      ? IpAddressTypes.PRIVATE
      : IpAddressTypes.PUBLIC;

  const connector = new Connector();
  try {
    await connector.startLocalProxy({
      instanceConnectionName,
      ipType,
      listenOptions: { path: socketPath },
    });

    process.env.DATABASE_URL = buildPostgresUrl({
      user,
      password,
      database,
      schema,
      socketHost: socketDir,
    });

    console.log(`Applying migrations (${instanceConnectionName}, db=${database})…`);
    const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
    console.log('Migrations applied.');
  } finally {
    connector.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
