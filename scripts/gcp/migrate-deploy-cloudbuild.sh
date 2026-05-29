#!/usr/bin/env bash
# Runs in Cloud Build (node image) with cloud-sql-proxy on 127.0.0.1:5432.
# Env: DATABASE_URL, CLOUD_SQL_CONNECTION (optional, for proxy only — set by caller)
set -euo pipefail

CONNECTION="${1:?Cloud SQL connection name required}"
DB_USER="${2:?DB user required}"
DB_NAME="${3:?DB name required}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

curl -fsSL -o /tmp/cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.2/cloud-sql-proxy.linux.amd64
chmod +x /tmp/cloud-sql-proxy
/tmp/cloud-sql-proxy "$CONNECTION" --port=5432 &
PROXY_PID=$!
trap 'kill "$PROXY_PID" 2>/dev/null || true' EXIT
sleep 5

npm ci
npx prisma generate

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?schema=public"

set +e
migrate_out="$(npx prisma migrate deploy 2>&1)"
migrate_code=$?
set -e
echo "$migrate_out"

if [ "$migrate_code" -eq 0 ]; then
  exit 0
fi

if echo "$migrate_out" | grep -q P3005; then
  echo "Non-empty DB without Prisma history — applying SQL then baselining…"
  for sql in prisma/migrations/*/migration.sql; do
    npx prisma db execute --file "$sql" || true
  done
  for dir in prisma/migrations/*/; do
    npx prisma migrate resolve --applied "$(basename "$dir")"
  done
  npx prisma migrate deploy
  exit $?
fi

exit "$migrate_code"
