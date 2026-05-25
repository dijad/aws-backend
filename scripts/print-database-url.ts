/**
 * Muestra la conexión configurada (contraseña enmascarada).
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { describeDatabaseConnection } from '../src/config/database-url';
import { isCloudSqlTarget } from '../src/config/db-config';
import { bootstrapDatabaseEnv, closeCloudSqlConnector } from '../src/config/cloud-sql';

config({ path: resolve(__dirname, '../.env') });

async function main() {
  if (isCloudSqlTarget()) {
    await bootstrapDatabaseEnv();
  } else {
    const { ensureDatabaseUrl } = await import('../src/config/database-url');
    ensureDatabaseUrl();
  }
  // eslint-disable-next-line no-console
  console.log(describeDatabaseConnection());
  if (isCloudSqlTarget()) {
    await closeCloudSqlConnector();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
