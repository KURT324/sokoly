FROM node:20-alpine AS builder

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
RUN npx prisma generate
RUN npm run build

# --- Production runner ---
FROM node:20-alpine AS runner

WORKDIR /app

# Copy shared package (must exist as symlink target for node_modules/@eduplatform/shared)
COPY --from=builder /app/packages/shared ./packages/shared

# Copy root node_modules (contains @eduplatform/shared -> ../../packages/shared symlink)
COPY --from=builder /app/node_modules ./node_modules

# Copy backend artifacts
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./package.json

RUN mkdir -p /app/storage

EXPOSE 3000

CMD ["node", "dist/index.js"]
