#!/usr/bin/env bash
# Carga variables GCP desde backend/.env y/o gcp/gcp.config.env (opcional).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env"
CONFIG_FILE="${GCP_CONFIG_FILE:-$ROOT/gcp/gcp.config.env}"

_load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    if [[ "$line" =~ ^(GCP_PROJECT_ID|GCP_REGION|CLOUD_SQL_INSTANCE|CLOUD_SQL_CONNECTION_NAME|DB_NAME|DB_USER)= ]]; then
      export "$line"
    fi
  done <"$file"
}

_load_env_file "$ENV_FILE"
_load_env_file "$CONFIG_FILE"

if [[ -z "${CLOUD_SQL_CONNECTION_NAME:-}" ]]; then
  if [[ -n "${GCP_PROJECT_ID:-}" && -n "${GCP_REGION:-}" && -n "${CLOUD_SQL_INSTANCE:-}" ]]; then
    export CLOUD_SQL_CONNECTION_NAME="${GCP_PROJECT_ID}:${GCP_REGION}:${CLOUD_SQL_INSTANCE}"
  fi
fi

export DB_NAME="${DB_NAME:-aws}"
export DB_USER="${DB_USER:-app_user}"
