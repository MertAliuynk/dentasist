#!/bin/sh
set -e

echo "Bekleyen Prisma migration'ları uygulanıyor..."
npx --yes prisma migrate deploy --schema=./prisma/schema.prisma

exec "$@"
