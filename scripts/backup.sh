#!/bin/bash
# EduPlatform — PostgreSQL backup script
# Crontab: 0 3 * * * /app/scripts/backup.sh >> /var/log/eduplatform-backup.log 2>&1

set -e

BACKUP_DIR="/backups"
DATE=$(date +"%Y-%m-%d_%H-%M")
FILENAME="backup_${DATE}.sql.gz"

# Load env from production file if available
if [ -f /app/.env.production ]; then
  export $(grep -v '^#' /app/.env.production | xargs)
fi

# Validate required vars
: "${POSTGRES_USER:?POSTGRES_USER is not set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set}"
: "${POSTGRES_DB:?POSTGRES_DB is not set}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: $FILENAME"

PGPASSWORD="$POSTGRES_PASSWORD" docker exec eduplatform_postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "[$(date)] Backup saved: ${BACKUP_DIR}/${FILENAME} ($(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Delete backups older than 30 days
DELETED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Deleted $DELETED old backup(s)"
fi

echo "[$(date)] Backup complete."
