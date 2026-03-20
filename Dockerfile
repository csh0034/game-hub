# ============================================
# Stage 1: 의존성 설치
# ============================================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: 빌드
# ============================================
FROM base AS builder
WORKDIR /app

ARG COMMIT_HASH=unknown
ENV NEXT_PUBLIC_COMMIT_HASH=$COMMIT_HASH

COPY . .
RUN pnpm build

# ============================================
# Stage 3: 프로덕션 이미지
# ============================================
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ENV NODE_ENV=production

# 보안: non-root 사용자 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gamehub

# Next.js standalone 출력 복사
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Express 서버 빌드 결과 복사
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# shared-types 빌드 결과 복사 (프로덕션에서는 dist 사용)
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/
RUN sed -i 's|"./src/index.ts"|"./dist/index.js"|g' packages/shared-types/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile --prod --filter @game-hub/server

# 프로세스 매니저 설치
RUN npm install -g concurrently

USER gamehub

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["concurrently", "node apps/web/server.js", "node apps/server/dist/index.js"]
