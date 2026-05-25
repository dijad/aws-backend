#!/usr/bin/env bash
# Guía: conectar a Cloud SQL existente con @google-cloud/cloud-sql-connector (sin proxy binario).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-config.sh
source "$SCRIPT_DIR/load-config.sh"

BACKEND_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ -z "${CLOUD_SQL_CONNECTION_NAME:-}" ]]; then
  echo "Faltan variables GCP en backend/.env:" >&2
  echo "  GCP_PROJECT_ID, GCP_REGION, CLOUD_SQL_INSTANCE" >&2
  echo "  o CLOUD_SQL_CONNECTION_NAME" >&2
  echo "" >&2
  echo "Copia backend/.env.example → backend/.env y completa la sección cloud-sql." >&2
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "  Cloud SQL · Node.js Connector (sin cloud-sql-proxy)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Connection name: $CLOUD_SQL_CONNECTION_NAME"
echo "  Database:        $DB_NAME"
echo "  User:            $DB_USER"
echo ""
echo "── 1. Autenticación GCP (una vez) ─────────────────────────"
echo "  gcloud auth application-default login"
echo ""
echo "── 2. Pega esto en backend/.env ────────────────────────────"
cat <<EOF
DB_TARGET=cloud-sql
GCP_PROJECT_ID=${GCP_PROJECT_ID:-}
GCP_REGION=${GCP_REGION:-}
CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE:-}
DB_USER=${DB_USER}
DB_PASSWORD=
DB_NAME=${DB_NAME}
EOF
echo ""
echo "── 3. Probar conexión y API ────────────────────────────────"
echo "  cd backend"
echo "  npm run db:print-url"
echo "  npm run prisma:deploy"
echo "  npm run seed"
echo "  npm run start:dev"
echo "  curl http://localhost:3001/api/health/db"
echo ""
echo "  O: ./scripts/gcp/verify-connection.sh"
echo ""
