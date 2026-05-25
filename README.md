# Global Notes — Backend

NestJS REST API + WebSocket gateway with PostgreSQL (via Prisma) and JWT authentication.

## Stack

- NestJS 10 (modular architecture, decorators, DI)
- Prisma ORM + PostgreSQL
- JWT access (short-lived) + opaque refresh tokens (persisted)
- Socket.IO gateway for realtime notifications (namespace `/ws`)
- Swagger UI auto-generated at `/api/docs`
- `class-validator` for DTO validation, `helmet`, `@nestjs/throttler` for hardening

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres   # PostgreSQL local (opcional)
npm install
npm run prisma:migrate -- --name init
npm run seed               # seeds roles/permissions/modules + admin user
npm run start:dev
```

Cloud SQL (GCP): `@google-cloud/cloud-sql-connector` — ver [docs/gcp-cloud-sql.md](./docs/gcp-cloud-sql.md). En `.env` usa `DB_TARGET=cloud-sql` y las variables `GCP_*` / `DB_*`.

The API listens on `http://localhost:3001/api`. Swagger UI is available at
`http://localhost:3001/api/docs` — click *Authorize*, paste a token from
`POST /auth/login`, and try requests directly from the docs.

## Architecture

```
src/
├── main.ts                 # bootstrap (Swagger, ValidationPipe, helmet, CORS, global filter)
├── app.module.ts           # root module wiring
├── prisma/                 # PrismaService (global)
├── auth/                   # /auth/login, /auth/refresh, /auth/logout, /auth/me
├── users/                  # /users CRUD (logical delete, mention candidates)
├── roles/                  # /roles, /permissions, /roles/:id/permissions (matrix)
├── modules/                # /modules CRUD — used by System Updates and Manual
├── notes/                  # /notes + sub-notes; PENDING → APPROVED/REJECTED
├── system-updates/         # state machine: PENDING → DEV_* → ADMIN_* → COMPLETED
├── manual/                 # FeatureDocument CRUD + Changelog
├── notifications/          # service + Socket.IO gateway
├── health/
└── common/                 # decorators (@CurrentUser, @Permissions, @Public),
                            # guards (Jwt, Permissions), filter (AllExceptions)
```

## RBAC

Two layers:

1. `JwtAuthGuard` (registered as APP_GUARD) — protects every route except `@Public()`.
2. `PermissionsGuard` (registered as APP_GUARD) — checks `@Permissions('CODE')` metadata.

Permissions are loaded into `req.user.permissions` from the `Role → RolePermission → Permission` graph at JWT validation time. The Admin can change which permissions belong to each role at runtime via `PUT /roles/:id/permissions` (no service restart needed).

### Default permission seeding

| Permission                       | Description                                |
| -------------------------------- | ------------------------------------------ |
| `USER_CREATE` / `_UPDATE` / `_DELETE` | User CRUD (logical delete)            |
| `ROLE_MANAGE`                    | Edit role-permission matrix                |
| `MODULE_MANAGE`                  | CRUD modules / categories                  |
| `NOTE_CREATE`                    | Create notes                               |
| `NOTE_SKIP_APPROVAL`             | Publish notes without approval (ADMIN role always skips) |
| `NOTE_APPROVE_REJECT`            | Approve/reject notes                       |
| `SYSTEM_UPDATE_CREATE`           | Create requests                            |
| `SYSTEM_UPDATE_REVIEW_AS_DEV`    | Developer review path                      |
| `SYSTEM_UPDATE_REVIEW_AS_ADMIN`  | Admin review path (final word)             |
| `MANUAL_EDIT` / `MANUAL_PUBLISH` | Manual authoring                           |

Seed assigns:
- ADMIN → all
- PROJECT_MANAGER → `NOTE_CREATE`, `SYSTEM_UPDATE_CREATE`
- DEVELOPER → `NOTE_CREATE`, `SYSTEM_UPDATE_CREATE`, `SYSTEM_UPDATE_REVIEW_AS_DEV`, `MANUAL_EDIT`

## State machines

### Notes
`PENDING` → `APPROVED` (notifies mentions/recipients) | `REJECTED` (sub-note with reason, only author notified).

### System Updates
`PENDING` → `DEV_APPROVED` (waits for Admin) → `ADMIN_APPROVED` (Dev tray) → `COMPLETED` (auto Changelog entry).
Either reviewer can reject (`DEV_REJECTED` / `ADMIN_REJECTED`) with a `REJECTION_REASON` comment. Admin always has the final word and can approve/reject directly without Dev.

## Realtime (`/ws`)

Socket.IO namespace authenticated via JWT (provide `auth.token` on `io()` connect).
On every server-side `Notification` creation, the service emits `notification:new` to the corresponding user room (`user:{id}`). Clients can also poll `GET /notifications` and `GET /notifications/unread-count` as a fallback.

## Email (Resend)

Every in-app notification also triggers an email to the recipient when `RESEND_API_KEY` is set and `EMAIL_ENABLED` is not `false`.

| Event | In-app type | Recipients |
| ----- | ----------- | ---------- |
| Note submitted | `NOTE_PENDING` | Users with `NOTE_APPROVE_REJECT` |
| Note approved (mention) | `NOTE_MENTION` | Mentioned users |
| Note approved (recipient) | `NOTE_RECEIVED` | Recipients |
| Note approved | `NOTE_APPROVED` | Author |
| Note rejected | `NOTE_REJECTED` | Author |
| System update created | `SYSTEM_UPDATE_NEW` | `ADMIN`, `DEVELOPER` roles |
| Dev approved | `SYSTEM_UPDATE_DEV_APPROVED` | `ADMIN` + requester |
| Dev rejected | `SYSTEM_UPDATE_DEV_REJECTED` | Requester |
| Admin approved | `SYSTEM_UPDATE_ADMIN_APPROVED` | Requester + `DEVELOPER` |
| Admin rejected | `SYSTEM_UPDATE_ADMIN_REJECTED` | Requester |
| Completed | `SYSTEM_UPDATE_COMPLETED` | Requester |

Configure in `backend/.env` (see `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`, `FRONTEND_URL` (links in emails).

## Common scripts

```bash
npm run start:dev        # watch mode
npm run build            # production build
npm run prisma:studio    # browse the DB
npm run prisma:migrate   # create + apply migration in dev
npm run seed             # rerun seed (idempotent)
```
