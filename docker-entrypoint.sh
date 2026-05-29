#!/bin/sh
set -e

run_migrations() {
  if [ -z "${DB_PASSWORD:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
    echo "Skipping migrations: DB_USER, DB_PASSWORD, or DB_NAME not set."
    return 0
  fi

  if [ -n "${CLOUD_SQL_CONNECTION_NAME:-}" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_CONNECTION_NAME}&schema=public"
  elif [ "$DB_TARGET" = "cloud-sql" ] || [ "$DB_TARGET" = "cloudsql" ]; then
    echo "Skipping migrations: CLOUD_SQL_CONNECTION_NAME required on Cloud Run."
    return 0
  else
    return 0
  fi

  echo "Running database migrations before start…"
  npx prisma migrate deploy
}

if [ "${SKIP_DB_MIGRATIONS:-}" != "true" ]; then
  run_migrations
fi

exec node dist/main.js
