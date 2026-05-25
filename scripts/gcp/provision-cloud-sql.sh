#!/usr/bin/env bash
# Crea instancia Cloud SQL PostgreSQL 16 (plantilla — revisa proyecto/región antes de ejecutar).
#
# Uso:
#   export GCP_PROJECT_ID="my-project"
#   export GCP_REGION="us-central1"
#   export CLOUD_SQL_INSTANCE="aws-postgres"
#   export DB_APP_PASSWORD="$(openssl rand -base64 24)"
#   ./scripts/gcp/provision-cloud-sql.sh

set -euo pipefail

PROJECT="${GCP_PROJECT_ID:-}"
REGION="${GCP_REGION:-us-central1}"
INSTANCE="${CLOUD_SQL_INSTANCE:-aws-postgres}"
DB_NAME="${DB_NAME:-aws}"
APP_USER="${DB_APP_USER:-app_user}"
APP_PASSWORD="${DB_APP_PASSWORD:-}"

if [[ -z "$PROJECT" ]]; then
  echo "Error: define GCP_PROJECT_ID" >&2
  exit 1
fi

if [[ -z "$APP_PASSWORD" ]]; then
  echo "Error: define DB_APP_PASSWORD (contraseña del usuario de aplicación)" >&2
  exit 1
fi

echo "Proyecto: $PROJECT | Región: $REGION | Instancia: $INSTANCE"

gcloud config set project "$PROJECT"

if ! gcloud sql instances describe "$INSTANCE" --project="$PROJECT" &>/dev/null; then
  gcloud sql instances create "$INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup-start-time=03:00 \
    --enable-point-in-time-recovery \
    --database-flags=cloudsql.iam_authentication=off
  echo "Instancia creada."
else
  echo "Instancia $INSTANCE ya existe."
fi

CONNECTION_NAME="${PROJECT}:${REGION}:${INSTANCE}"

gcloud sql databases create "$DB_NAME" --instance="$INSTANCE" --project="$PROJECT" 2>/dev/null || true

gcloud sql users create "$APP_USER" \
  --instance="$INSTANCE" \
  --password="$APP_PASSWORD" \
  --project="$PROJECT" 2>/dev/null || \
gcloud sql users set-password "$APP_USER" \
  --instance="$INSTANCE" \
  --password="$APP_PASSWORD" \
  --project="$PROJECT"

echo ""
echo "── Cloud SQL listo — añade a backend/.env ─────────────────"
echo ""
echo "DB_TARGET=cloud-sql"
echo "GCP_PROJECT_ID=$PROJECT"
echo "GCP_REGION=$REGION"
echo "CLOUD_SQL_INSTANCE=$INSTANCE"
echo "DB_USER=$APP_USER"
echo "DB_PASSWORD=$APP_PASSWORD"
echo "DB_NAME=$DB_NAME"
echo ""
echo "Luego:"
echo "  cd backend && npm run prisma:deploy && npm run seed && npm run start:dev"
echo ""
