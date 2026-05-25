#!/usr/bin/env bash
# Lista instancias Cloud SQL del proyecto (connection name).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=load-config.sh
source "$SCRIPT_DIR/load-config.sh" 2>/dev/null || true

PROJECT="${GCP_PROJECT_ID:-${1:-}}"
if [[ -z "$PROJECT" ]]; then
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
fi

if [[ -z "$PROJECT" ]]; then
  echo "Uso: GCP_PROJECT_ID=mi-proyecto ./scripts/gcp/list-instances.sh" >&2
  echo "  o define GCP_PROJECT_ID en backend/.env" >&2
  exit 1
fi

echo "Instancias Cloud SQL en proyecto: $PROJECT"
echo ""
gcloud sql instances list --project="$PROJECT" \
  --format="table(name,region,databaseVersion,state,connectionName)"
