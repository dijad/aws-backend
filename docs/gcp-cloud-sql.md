# Google Cloud SQL (PostgreSQL)

Conexión con **[Cloud SQL Node.js Connector](https://github.com/GoogleCloudPlatform/cloud-sql-nodejs-connector)** (`@google-cloud/cloud-sql-connector`) + Prisma. No se usa el binario `cloud-sql-proxy`.

Todos los comandos desde **`backend/`**.

## Modos de conexión

| `DB_TARGET` | Uso |
|-------------|-----|
| `local` | Postgres en Docker (`docker compose up -d postgres`) |
| `cloud-sql` | Instancia en GCP vía connector Node (local, migraciones y API) |

Implementación: `src/config/cloud-sql.ts`, `src/config/db-config.ts`.

## Requisitos (cloud-sql)

1. [gcloud CLI](https://cloud.google.com/sdk/docs/install) instalado.
2. Autenticación:

```bash
gcloud auth login
gcloud auth application-default login
```

3. Rol **`roles/cloudsql.client`** en el proyecto (tu usuario o cuenta de servicio).
4. API **Cloud SQL Admin** habilitada.

## Conectar instancia existente

### 1. Listar instancias (opcional)

```bash
cd backend
GCP_PROJECT_ID=tu-proyecto ./scripts/gcp/list-instances.sh
```

Copia el **connection name** (`proyecto:region:instancia`) de la tabla.

### 2. Configurar `.env`

Edita `backend/.env`:

```env
DB_TARGET=cloud-sql

GCP_PROJECT_ID=tu-proyecto
GCP_REGION=us-central1
CLOUD_SQL_INSTANCE=nombre-instancia

DB_USER=app_user
DB_PASSWORD=tu-contraseña
DB_NAME=aws
```

Alternativa: una sola variable en lugar de las tres `GCP_*`:

```env
CLOUD_SQL_CONNECTION_NAME=tu-proyecto:us-central1:nombre-instancia
```

Opcional:

```env
CLOUD_SQL_IP_TYPE=PUBLIC    # o PRIVATE
CLOUD_SQL_AUTH_TYPE=PASSWORD  # o IAM
```

Guía interactiva:

```bash
./scripts/gcp/connect-local.sh
```

### 3. Probar y arrancar

```bash
npm run db:print-url
npm run prisma:deploy
npm run seed          # primera vez
npm run start:dev
curl http://localhost:3001/api/health/db
```

No hace falta levantar ningún proxy en otra terminal: el connector se inicia con la API y con los scripts Prisma.

## Postgres local (Docker)

```env
DB_TARGET=local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aws?schema=public
```

```bash
docker compose up -d postgres
npm run start:dev
```

## Crear instancia nueva en GCP

```bash
cd backend
export GCP_PROJECT_ID="tu-proyecto"
export GCP_REGION="us-central1"
export CLOUD_SQL_INSTANCE="aws-postgres"
export DB_APP_PASSWORD="$(openssl rand -base64 24)"

./scripts/gcp/provision-cloud-sql.sh
```

Luego pega los valores impresos en `.env` con `DB_TARGET=cloud-sql`.

## Cloud Run (producción)

Pipeline completo (Docker + Cloud Build): [gcp-deploy.md](./gcp-deploy.md).

En el servicio Cloud Run:

1. Añade la instancia en **Connections → Cloud SQL**.
2. Variables de entorno (o Secret Manager para la contraseña):

```env
DB_TARGET=cloud-sql
CLOUD_SQL_CONNECTION_NAME=proyecto:region:instancia
DB_USER=app_user
DB_PASSWORD=<secret>
DB_NAME=aws
```

En Cloud Run el connector usa la cuenta de servicio del servicio (no ADC local).

## Secret Manager

```bash
echo -n "tu-password" | gcloud secrets create aws-db-password --data-file=-

gcloud run services update aws-api \
  --set-secrets=DB_PASSWORD=aws-db-password:latest
```

## IAM mínimo

| Rol | Uso |
|-----|-----|
| `roles/cloudsql.client` | Desarrollo local (ADC) y Cloud Run |
| `roles/cloudsql.admin` | Solo `provision-cloud-sql.sh` |
| `roles/secretmanager.secretAccessor` | Leer `DB_PASSWORD` en prod |

## Copia de prod → Docker (DBeaver local, más simple)

Sin proxy permanente: un dump y trabajas en `localhost:5432`.

```bash
cd backend

# 1. Requiere: brew install cloud-sql-proxy  (y pg_dump del cliente Postgres)
#    backend/.env con CLOUD_SQL_* / DB_USER / DB_NAME (y DB_PASSWORD o secret en GCP)
./scripts/gcp/dump-from-cloud.sh

# 2. Carga en Postgres Docker
docker compose up -d postgres
./scripts/gcp/restore-to-docker.sh

# Atajos npm:
npm run db:dump:cloud
npm run db:restore:local
```

En `backend/.env` para la API local:

```env
DB_TARGET=local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aws?schema=public
```

**DBeaver:** `localhost` · `5432` · `postgres` / `postgres` · base `aws`.

Los dumps van a `backend/dumps/` (ignorados por git). No subas dumps con datos de producción.

## Scripts en `scripts/gcp/`

| Script | Descripción |
|--------|-------------|
| `list-instances.sh` | Lista instancias y connection names |
| `connect-local.sh` | Guía y fragmento para `.env` |
| `verify-connection.sh` | Ejecuta `npm run db:print-url` |
| `provision-cloud-sql.sh` | Crea instancia + DB + usuario (entornos nuevos) |
| `dump-from-cloud.sh` | `pg_dump` vía `cloud-sql-proxy` → `dumps/aws-gcp-*.sql` |
| `restore-to-docker.sh` | Restaura el último dump en `docker compose` Postgres |

`gcp/gcp.config.env` es **opcional** (solo para scripts `gcp`); lo recomendado es definir todo en `backend/.env`.
