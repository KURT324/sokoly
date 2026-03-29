FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first (for better layer caching)
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

# Install all workspace dependencies
RUN npm install

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend

# Build frontend (tsc + vite build)
WORKDIR /app/apps/frontend
RUN npm run build

# --- Production runner (nginx static file server) ---
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
