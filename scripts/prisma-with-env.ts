/**
 * Ejecuta Prisma CLI con la configuración de base de datos del .env.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { bootstrapDatabaseEnv, closeCloudSqlConnector } from '../src/config/cloud-sql';
import { isCloudSqlTarget } from '../src/config/db-config';

config({ path: resolve(__dirname, '../.env') });

async function main() {
  await bootstrapDatabaseEnv();

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: ts-node scripts/prisma-with-env.ts <prisma-args...>');
    process.exit(1);
  }

  const result = spawnSync('npx', ['prisma', ...args], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (isCloudSqlTarget()) {
    await closeCloudSqlConnector();
  }

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
