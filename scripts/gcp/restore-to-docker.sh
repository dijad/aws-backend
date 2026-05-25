#!/usr/bin/env bash
# Restaura un dump SQL en Postgres local (docker compose).
# Uso: ./scripts/gcp/restore-to-docker.sh [archivo.sql]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DUMPS_DIR="$ROOT/dumps"
COMPOSE_FILE="$ROOT/docker-compose.yml"
CONTAINER="${POSTGRES_CONTAINER:-global-notes-postgres}"
LOCAL_USER="${LOCAL_DB_USER:-postgres}"
LOCAL_PASSWORD="${LOCAL_DB_PASSWORD:-postgres}"
LOCAL_DB="${LOCAL_DB_NAME:-aws}"

usage() {
  cat <<EOF
Uso: $(basename "$0") [archivo.sql]

Sin argumentos, usa dumps/aws-gcp-latest.sql (creado por dump-from-cloud.sh).

Después del restore, en backend/.env:
  DB_TARGET=local
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aws?schema=public

DBeaver: localhost:5432 · postgres / postgres · base aws
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "No se encontró '$1'." >&2
    exit 1
  fi
}

require_cmd docker

resolve_dump() {
  if [[ -n "${1:-}" ]]; then
    if [[ ! -f "$1" ]]; then
      echo "No existe el archivo: $1" >&2
      exit 1
    fi
    echo "$1"
    return
  fi
  local latest="$DUMPS_DIR/aws-gcp-latest.sql"
  if [[ -L "$latest" || -f "$latest" ]]; then
    echo "$(cd "$(dirname "$latest")" && pwd)/$(basename "$latest")"
    return
  fi
  local newest
  newest="$(ls -t "$DUMPS_DIR"/aws-gcp-*.sql 2>/dev/null | head -1 || true)"
  if [[ -n "$newest" ]]; then
    echo "$newest"
    return
  fi
  echo "No hay dump. Ejecuta primero: ./scripts/gcp/dump-from-cloud.sh" >&2
  exit 1
}

DUMP_FILE="$(resolve_dump "${1:-}")"

echo "Levantando Postgres local..."
docker compose -f "$COMPOSE_FILE" up -d postgres

echo "Esperando Postgres..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$LOCAL_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$CONTAINER" pg_isready -U "$LOCAL_USER" >/dev/null 2>&1; then
  echo "Postgres no está listo en el contenedor ${CONTAINER}." >&2
  exit 1
fi

echo "Restaurando ${DUMP_FILE} en base local '${LOCAL_DB}'..."
docker exec -i "$CONTAINER" env PGPASSWORD="$LOCAL_PASSWORD" \
  psql -v ON_ERROR_STOP=1 -U "$LOCAL_USER" -d "$LOCAL_DB" <"$DUMP_FILE"

echo ""
echo "Restore completado."
echo ""
echo "  DBeaver:  host=localhost  port=5432  database=${LOCAL_DB}  user=${LOCAL_USER}  password=${LOCAL_PASSWORD}"
echo "  Backend:  DB_TARGET=local en backend/.env"
echo "  Probar:   cd backend && npm run start:dev"
