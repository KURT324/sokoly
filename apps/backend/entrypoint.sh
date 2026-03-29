#!/bin/sh
set -e

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Pushing schema to database..."
npx prisma db push --accept-data-loss

echo "==> Running seed..."
npx ts-node prisma/seed.ts || echo "Seed already applied, skipping."

echo "==> Starting dev server..."
exec npx ts-node-dev --respawn --transpile-only --poll -r tsconfig-paths/register src/index.ts
