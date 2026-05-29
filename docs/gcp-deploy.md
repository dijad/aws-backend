# Despliegue en GCP (Cloud Run + Cloud SQL)

Guía para desplegar [aws-backend](https://github.com/dijad/aws-backend) y [aws-frontend](https://github.com/dijad/aws-frontend) en Google Cloud.

## Arquitectura

| Componente | Servicio |
|------------|----------|
| PostgreSQL | Cloud SQL |
| API + WebSocket `/ws` | Cloud Run `aws-api` |
| Nuxt SSR | Cloud Run `aws-frontend` |
| Imágenes Docker | Artifact Registry (`aws`) |
| Secretos | Secret Manager |

Conexión a base de datos: [gcp-cloud-sql.md](./gcp-cloud-sql.md).

## 1. Requisitos

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project TU_PROYECTO

gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com
```

## 2. IAM para Cloud Build (una vez)

Los builds usan la cuenta `PROJECT_NUMBER-compute@developer.gserviceaccount.com`. Sin estos permisos el paso **deploy** falla con `run.services.get` o `iam.serviceaccounts.actAs`.

```bash
cd backend
export GCP_PROJECT_ID=tu-proyecto
./scripts/gcp/setup-cloud-build-iam.sh
```

## 3. Artifact Registry (una vez)

```bash
gcloud artifacts repositories create aws \
  --repository-format=docker \
  --location=australia-southeast1
```

## 4. Cloud SQL

Si no tienes instancia:

```bash
cd backend
export GCP_PROJECT_ID="TU_PROYECTO"
export GCP_REGION="us-central1"
export CLOUD_SQL_INSTANCE="aws-postgres"
export DB_APP_PASSWORD="$(openssl rand -base64 24)"
./scripts/gcp/provision-cloud-sql.sh
```

Anota `CLOUD_SQL_CONNECTION_NAME` (`proyecto:region:instancia`).

### Migraciones

En cada `gcloud builds submit`, el paso **migrate** las aplica automáticamente.

Manual (opcional), desde tu máquina con ADC y `DB_TARGET=cloud-sql` en `backend/.env`:

```bash
npm run prisma:deploy
npm run seed   # solo la primera vez
```

## 5. Secret Manager

```bash
echo -n "tu-db-password" | gcloud secrets create aws-db-password --data-file=-
echo -n "jwt-access-secret" | gcloud secrets create aws-jwt-access --data-file=-
echo -n "jwt-refresh-secret" | gcloud secrets create aws-jwt-refresh --data-file=-
echo -n "re_xxx" | gcloud secrets create aws-resend-api-key --data-file=-
```

Otorga a la cuenta de servicio de Cloud Run `roles/secretmanager.secretAccessor` y `roles/cloudsql.client`.

Variables de entorno adicionales en Cloud Run (no secretas):

- `CLOUD_SQL_CONNECTION_NAME`
- `DB_USER`, `DB_NAME`
- `EMAIL_FROM`

```bash
gcloud run services update aws-api \
  --region=us-central1 \
  --set-env-vars="CLOUD_SQL_CONNECTION_NAME=proyecto:region:instancia,DB_USER=app_user,DB_NAME=aws,EMAIL_FROM=noreply@tudominio.com"
```

## 6. Backend (API)

### Build local (opcional)

```bash
cd backend
docker build -t aws-api:local .
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e DB_TARGET=cloud-sql \
  ... \
  aws-api:local
```

### Cloud Build + deploy (pipeline completo)

`cloudbuild.yaml` ejecuta en cada deploy:

1. **migrate** — `prisma migrate deploy` contra Cloud SQL (Secret Manager `aws-db-password`)
2. **build** / **push** — imagen Docker
3. **deploy** — Cloud Run (solo si migrate terminó bien)

La imagen también corre migraciones al arrancar (`docker-entrypoint.sh`) como respaldo. Para desactivarlas en runtime: `SKIP_DB_MIGRATIONS=true`.

Ajusta los valores `_…` en el archivo si cambian, luego:

```bash
cd backend
gcloud builds submit --config=cloudbuild.yaml --project=TU_PROYECTO
```

Opcional: sobrescribir sin editar el archivo:

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_CORS_ORIGIN=https://tu-frontend.run.app,_FRONTEND_URL=https://tu-frontend.run.app
```

Obtén la URL del API:

```bash
gcloud run services describe aws-api --region=$REGION --format='value(status.url)'
```

Prueba: `curl https://TU-API.run.app/api/health`

## 7. Frontend (Nuxt)

Las variables `NUXT_PUBLIC_*` se **bakean en el build**. Usa la URL real del API:

```bash
cd frontend
gcloud builds submit --config=cloudbuild.yaml --project=TU_PROYECTO
```

Las URLs del API (`_API_BASE`, `_WS_BASE`) están en `cloudbuild.yaml`; actualízalas tras el primer deploy del backend.

URL del frontend:

```bash
gcloud run services describe aws-frontend --region=$REGION --format='value(status.url)'
```

## 8. CORS (después del frontend)

Actualiza el API con la URL final del frontend:

```bash
gcloud run services update aws-api \
  --region=$REGION \
  --update-env-vars="CORS_ORIGIN=https://aws-frontend-xxxxx.run.app,FRONTEND_URL=https://aws-frontend-xxxxx.run.app"
```

## 9. Trigger en GitHub (opcional)

En Cloud Build → Triggers:

| Repo | Archivo | Rama |
|------|---------|------|
| `dijad/aws-backend` | `cloudbuild.yaml` | `main` |
| `dijad/aws-frontend` | `cloudbuild.yaml` | `main` |

Configura sustituciones `_CLOUD_SQL_CONNECTION`, `_API_BASE`, `_CORS_ORIGIN` en el trigger del frontend/backend.

## 10. Checklist

- [ ] Cloud SQL creado y migraciones aplicadas
- [ ] Secretos creados y accesibles por Cloud Run
- [ ] `aws-api` responde `/api/health` y `/api/health/db`
- [ ] `aws-frontend` carga login
- [ ] Login + notificaciones (WebSocket) funcionan
- [ ] `CORS_ORIGIN` apunta al dominio del frontend

## Archivos en el repo

| Archivo | Descripción |
|---------|-------------|
| `Dockerfile` | Imagen producción (puerto 8080) |
| `.dockerignore` | Excluye `node_modules`, `.env`, etc. |
| `cloudbuild.yaml` | Pipeline build → push → deploy (termina solo) |
| `scripts/gcp/setup-cloud-build-iam.sh` | Permisos IAM para Cloud Build |
