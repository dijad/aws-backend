import { mkdir } from 'fs/promises';
import { join } from 'path';
import {
  AuthTypes,
  Connector,
  IpAddressTypes,
  type ConnectionOptions,
} from '@google-cloud/cloud-sql-connector';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPostgresUrl, ensureDatabaseUrl } from './database-url';
import {
  getCloudSqlCredentials,
  isCloudSqlTarget,
  resolveCloudSqlConnectionName,
} from './db-config';

let connector: Connector | null = null;
let pool: Pool | null = null;
let prismaAdapter: PrismaPg | null = null;
let cliConnector: Connector | null = null;

function getIpType(): IpAddressTypes {
  return process.env.CLOUD_SQL_IP_TYPE?.trim().toUpperCase() === 'PRIVATE'
    ? IpAddressTypes.PRIVATE
    : IpAddressTypes.PUBLIC;
}

function getConnectionOptions(): ConnectionOptions {
  const opts: ConnectionOptions = {
    instanceConnectionName: resolveCloudSqlConnectionName(),
    ipType: getIpType(),
  };
  if (process.env.CLOUD_SQL_AUTH_TYPE?.trim().toUpperCase() === 'IAM') {
    opts.authType = AuthTypes.IAM;
  }
  return opts;
}

/** Pool + adapter para NestJS / Prisma en runtime. */
export async function initCloudSqlConnector(): Promise<PrismaPg> {
  if (prismaAdapter) return prismaAdapter;

  const creds = getCloudSqlCredentials();
  connector = new Connector();
  const clientOpts = await connector.getOptions(getConnectionOptions());

  pool = new Pool({
    ...clientOpts,
    user: creds.user,
    password: creds.password,
    database: creds.database,
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });

  prismaAdapter = new PrismaPg(pool);
  return prismaAdapter;
}

export function getCloudSqlPrismaAdapter(): PrismaPg {
  if (!prismaAdapter) {
    throw new Error('Cloud SQL connector no inicializado. Llama initCloudSqlConnector() primero.');
  }
  return prismaAdapter;
}

/** Proxy local para Prisma CLI (migrate, studio) que aún requiere DATABASE_URL. */
export async function bootstrapCloudSqlForPrismaCli(): Promise<void> {
  if (cliConnector) return;

  const creds = getCloudSqlCredentials();
  const socketDir = join(process.cwd(), '.cloud-sql');
  const socketPath = join(socketDir, '.s.PGSQL.5432');
  await mkdir(socketDir, { recursive: true });

  cliConnector = new Connector();
  await cliConnector.startLocalProxy({
    ...getConnectionOptions(),
    listenOptions: { path: socketPath },
  });

  process.env.DATABASE_URL = buildPostgresUrl({
    user: creds.user,
    password: creds.password,
    database: creds.database,
    schema: creds.schema,
    host: 'localhost',
    socketHost: socketDir,
  });
}

export async function closeCloudSqlConnector(): Promise<void> {
  await pool?.end().catch(() => undefined);
  pool = null;
  prismaAdapter = null;
  connector?.close();
  connector = null;
  cliConnector?.close();
  cliConnector = null;
}

export async function bootstrapDatabaseEnv(): Promise<void> {
  if (!isCloudSqlTarget()) {
    ensureDatabaseUrl();
    return;
  }
  await bootstrapCloudSqlForPrismaCli();
}
