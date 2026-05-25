#!/usr/bin/env bash
# Dump Cloud SQL (PostgreSQL) via cloud-sql-auth-proxy → archivo SQL local.
# Uso: ./scripts/gcp/dump-from-cloud.sh [ruta-salida.sql]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-config.sh
source "$SCRIPT_DIR/load-config.sh"

ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DUMPS_DIR="$ROOT/dumps"
PROXY_PORT="${PROXY_PORT:-5433}"
PROXY_PID=""
STARTED_PROXY=0

usage() {
  cat <<EOF
Uso: $(basename "$0") [archivo.sql]

Variables (backend/.env o entorno):
  CLOUD_SQL_CONNECTION_NAME  o  GCP_PROJECT_ID + GCP_REGION + CLOUD_SQL_INSTANCE
  DB_USER, DB_NAME
  DB_PASSWORD  (si falta, intenta Secret Manager: aws-db-password)

Opciones:
  PROXY_PORT=5433   Puerto local del cloud-sql-proxy

Requisitos: gcloud ADC, cloud-sql-proxy, pg_dump
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${CLOUD_SQL_CONNECTION_NAME:-}" ]]; then
  echo "Falta CLOUD_SQL_CONNECTION_NAME (o GCP_PROJECT_ID + GCP_REGION + CLOUD_SQL_INSTANCE) en backend/.env" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "No se encontró '$1'. Instálalo e inténtalo de nuevo." >&2
    exit 1
  fi
}

require_cmd cloud-sql-proxy
require_cmd pg_dump
require_cmd gcloud

_load_password() {
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    return 0
  fi
  if [[ -f "$ROOT/.env" ]]; then
    local line
    line="$(grep -E '^DB_PASSWORD=' "$ROOT/.env" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      DB_PASSWORD="${line#DB_PASSWORD=}"
      DB_PASSWORD="${DB_PASSWORD%\"}"
      DB_PASSWORD="${DB_PASSWORD#\"}"
      DB_PASSWORD="${DB_PASSWORD%\'}"
      DB_PASSWORD="${DB_PASSWORD#\'}"
    fi
  fi
  if [[ -z "${DB_PASSWORD:-}" && -n "${GCP_PROJECT_ID:-}" ]]; then
    echo "Leyendo contraseña desde Secret Manager (aws-db-password)..."
    DB_PASSWORD="$(gcloud secrets versions access latest \
      --secret=aws-db-password \
      --project="${GCP_PROJECT_ID}")"
  fi
  if [[ -z "${DB_PASSWORD:-}" ]]; then
    echo "Define DB_PASSWORD en backend/.env o configura el secret aws-db-password." >&2
    exit 1
  fi
}

port_open() {
  (echo >/dev/tcp/127.0.0.1/"$PROXY_PORT") >/dev/null 2>&1
}

cleanup() {
  if [[ "$STARTED_PROXY" == 1 && -n "$PROXY_PID" ]]; then
    kill "$PROXY_PID" 2>/dev/null || true
    wait "$PROXY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

_load_password

mkdir -p "$DUMPS_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT="${1:-$DUMPS_DIR/aws-gcp-${TIMESTAMP}.sql}"
if [[ "$(cd "$(dirname "$OUTPUT")" && pwd)" == "$DUMPS_DIR" ]]; then
  ln -sfn "$(basename "$OUTPUT")" "$DUMPS_DIR/aws-gcp-latest.sql"
fi

if port_open; then
  echo "Usando proxy existente en 127.0.0.1:${PROXY_PORT}"
else
  echo "Iniciando cloud-sql-proxy (${CLOUD_SQL_CONNECTION_NAME}) en puerto ${PROXY_PORT}..."
  cloud-sql-proxy "${CLOUD_SQL_CONNECTION_NAME}" --port "${PROXY_PORT}" &
  PROXY_PID=$!
  STARTED_PROXY=1
  for _ in $(seq 1 30); do
    if port_open; then
      break
    fi
    sleep 1
  done
  if ! port_open; then
    echo "El proxy no respondió en el puerto ${PROXY_PORT}." >&2
    exit 1
  fi
fi

echo "Generando dump → ${OUTPUT}"
export PGPASSWORD="${DB_PASSWORD}"
pg_dump \
  -h 127.0.0.1 \
  -p "${PROXY_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "${OUTPUT}"

unset PGPASSWORD

echo ""
echo "Listo: ${OUTPUT}"
echo "Siguiente paso: ./scripts/gcp/restore-to-docker.sh"
