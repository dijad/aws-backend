#!/usr/bin/env bash
# One-time IAM for Cloud Build → Artifact Registry → Cloud Run (default Compute SA).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Set GCP_PROJECT_ID or gcloud config set project" >&2
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Project: $PROJECT_ID"
echo "Compute SA (runs builds): $COMPUTE_SA"

bind_project() {
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$1" --role="$2" --condition=None --quiet >/dev/null
}

bind_sa() {
  gcloud iam service-accounts add-iam-policy-binding "$2" \
    --project="$PROJECT_ID" \
    --member="$1" --role="$3" --quiet >/dev/null
}

for role in storage.admin artifactregistry.writer run.developer cloudsql.client logging.logWriter secretmanager.secretAccessor; do
  bind_project "serviceAccount:${COMPUTE_SA}" "roles/${role}"
done

for role in storage.admin artifactregistry.writer run.admin cloudsql.client iam.serviceAccountUser secretmanager.secretAccessor; do
  bind_project "serviceAccount:${CLOUDBUILD_SA}" "roles/${role}"
done

# Cloud Run deploy needs actAs on the runtime service account
bind_sa "serviceAccount:${COMPUTE_SA}" "$COMPUTE_SA" "roles/iam.serviceAccountUser"
bind_sa "serviceAccount:${CLOUDBUILD_SA}" "$COMPUTE_SA" "roles/iam.serviceAccountUser"

echo "Done. Cloud Build can build, push, and deploy."
