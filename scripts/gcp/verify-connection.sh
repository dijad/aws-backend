#!/usr/bin/env bash
# Valida configuración Cloud SQL y muestra resumen (npm run db:print-url).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! grep -qE '^DB_TARGET=cloud-sql' .env 2>/dev/null; then
  echo "Aviso: DB_TARGET no es cloud-sql en .env" >&2
  echo "Edita backend/.env y establece DB_TARGET=cloud-sql" >&2
fi

echo "Comprobando conexión con @google-cloud/cloud-sql-connector..."
npm run db:print-url
