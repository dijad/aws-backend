# syntax=docker/dockerfile:1
# NestJS API for Cloud Run (port 8080, Cloud SQL via connector at runtime)

FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY prisma ./prisma
COPY scripts/run-migrate-deploy.mjs ./scripts/run-migrate-deploy.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
