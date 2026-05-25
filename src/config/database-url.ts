import {
  getCloudSqlCredentials,
  getDbTarget,
  isCloudSqlTarget,
  resolveCloudSqlConnectionName,
} from './db-config';

export interface DatabaseUrlParts {
  user: string;
  password: string;
  database: string;
  schema: string;
  host: string;
  port?: string;
  ssl?: boolean;
}

function encodePg(value: string): string {
  return encodeURIComponent(value);
}

/** Construye URL PostgreSQL estándar o con host= directorio del socket (Prisma + proxy local). */
export function buildPostgresUrl(parts: DatabaseUrlParts & { socketHost?: string }): string {
  const schema = parts.schema || 'public';
  const base = `postgresql://${encodePg(parts.user)}:${encodePg(parts.password)}@`;

  if (parts.socketHost) {
    const params = new URLSearchParams({
      host: parts.socketHost,
      schema,
    });
    if (parts.ssl) params.set('sslmode', 'require');
    return `${base}localhost/${encodePg(parts.database)}?${params.toString()}`;
  }

  const port = parts.port ?? '5432';
  const params = new URLSearchParams({ schema });
  if (parts.ssl) params.set('sslmode', 'require');
  return `${base}${parts.host}:${port}/${encodePg(parts.database)}?${params.toString()}`;
}

/** URL para Postgres local (DB_TARGET=local). */
export function resolveDatabaseUrl(): string {
  if (isCloudSqlTarget()) {
    const creds = getCloudSqlCredentials();
    return buildPostgresUrl({
      ...creds,
      host: 'cloud-sql',
      port: undefined,
    });
  }

  const explicit = process.env.DATABASE_URL?.trim();
  if (!explicit) {
    throw new Error(
      'DATABASE_URL es obligatoria cuando DB_TARGET=local. Ej.: postgresql://postgres:postgres@localhost:5432/aws?schema=public',
    );
  }
  return explicit;
}

export function ensureDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  process.env.DATABASE_URL = url;
  return url;
}

/** Resumen para npm run db:print-url (sin contraseña). */
export function describeDatabaseConnection(): string {
  const target = getDbTarget();
  if (target === 'local') {
    const url = process.env.DATABASE_URL?.trim() ?? resolveDatabaseUrl();
    return url.replace(/:([^:@/]+)@/, ':****@');
  }
  const creds = getCloudSqlCredentials();
  return [
    'target=cloud-sql',
    `instance=${resolveCloudSqlConnectionName()}`,
    `user=${creds.user}`,
    `database=${creds.database}`,
    `ipType=${process.env.CLOUD_SQL_IP_TYPE ?? 'PUBLIC'}`,
    'password=****',
  ].join(' ');
}
