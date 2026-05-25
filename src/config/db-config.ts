/**
 * Configuración mínima de base de datos.
 * DB_TARGET=local     → Postgres local (Docker / DATABASE_URL)
 * DB_TARGET=cloud-sql → Cloud SQL vía @google-cloud/cloud-sql-connector
 */

export type DbTarget = 'local' | 'cloud-sql';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno "${name}" (DB_TARGET=${process.env.DB_TARGET ?? 'local'})`);
  }
  return value;
}

/** local | cloud-sql — también acepta DB_CONNECTION_MODE legacy (url → local, tcp/cloud-sql-socket → cloud-sql). */
export function getDbTarget(): DbTarget {
  const target = process.env.DB_TARGET?.trim().toLowerCase();
  if (target === 'cloud-sql' || target === 'cloudsql') return 'cloud-sql';
  if (target === 'local') return 'local';

  const legacy = process.env.DB_CONNECTION_MODE?.trim();
  if (legacy === 'tcp' || legacy === 'cloud-sql-socket' || legacy === 'cloud-sql') {
    return 'cloud-sql';
  }
  if (process.env.CLOUD_SQL_CONNECTION_NAME?.trim()) return 'cloud-sql';
  if (
    process.env.GCP_PROJECT_ID?.trim() &&
    process.env.GCP_REGION?.trim() &&
    process.env.CLOUD_SQL_INSTANCE?.trim()
  ) {
    return 'cloud-sql';
  }

  return 'local';
}

export function isCloudSqlTarget(): boolean {
  return getDbTarget() === 'cloud-sql';
}

/** `proyecto:region:instancia` — explícito o armado desde GCP_* */
export function resolveCloudSqlConnectionName(): string {
  const explicit = process.env.CLOUD_SQL_CONNECTION_NAME?.trim();
  if (explicit) return explicit;

  const project = required('GCP_PROJECT_ID');
  const region = required('GCP_REGION');
  const instance = required('CLOUD_SQL_INSTANCE');
  return `${project}:${region}:${instance}`;
}

export function getCloudSqlCredentials() {
  return {
    user: process.env.DB_USER?.trim() || 'postgres',
    password: required('DB_PASSWORD'),
    database: process.env.DB_NAME?.trim() || 'aws',
    schema: process.env.DB_SCHEMA?.trim() || 'public',
  };
}
