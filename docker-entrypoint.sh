#!/bin/sh
set -e

if [ "${SKIP_DB_MIGRATIONS:-}" != "true" ]; then
  if [ "$DB_TARGET" = "cloud-sql" ] || [ "$DB_TARGET" = "cloudsql" ] || [ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]; then
    export DB_TARGET="${DB_TARGET:-cloud-sql}"
    echo "Running database migrations before start…"
    node scripts/run-migrate-deploy.mjs
  fi
fi

exec node dist/main.js
