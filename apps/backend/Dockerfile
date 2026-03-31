FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy workspace manifests first (for better layer caching)
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install all workspace dependencies
RUN npm install

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package first (backend requires @eduplatform/shared/dist at runtime)
WORKDIR /app/packages/shared
RUN npm run build

# Generate Prisma client and build TypeScript
WORKDIR /app/apps/backend
RUN apt-get update -y && apt-get install -y openssl
RUN npx prisma generate
RUN npm run build

# --- Production runner ---
FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy shared package (must exist as symlink target for node_modules/@eduplatform/shared)
COPY --from=builder /app/packages/shared ./packages/shared

# Copy root node_modules (contains prisma CLI + @prisma/client)
COPY --from=builder /app/node_modules ./node_modules

# Copy backend artifacts
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./package.json

# Generate Prisma client in runner so the engine binary matches this environment
RUN npx prisma generate --schema ./prisma/schema.prisma

RUN mkdir -p /app/storage

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
