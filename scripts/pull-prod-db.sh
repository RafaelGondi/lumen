#!/usr/bin/env bash
set -euo pipefail

SERVER="root@137.184.195.81"
REMOTE_DB="/app/.data/lumen.sqlite3"
STAMP="$(date +%Y%m%d-%H%M%S)"
REMOTE_EXPORT="/tmp/lumen-pull-${STAMP}.sqlite3"
LOCAL_DIR=".data"
LOCAL_DB="${LOCAL_DIR}/lumen.sqlite3"
LOCAL_BACKUP="${LOCAL_DIR}/backups/lumen-local-${STAMP}.sqlite3"

mkdir -p "${LOCAL_DIR}/backups"

if [[ -f "${LOCAL_DB}" ]]; then
  cp "${LOCAL_DB}" "${LOCAL_BACKUP}"
  echo "Backup local: ${LOCAL_BACKUP}"
fi

echo "Gerando snapshot consistente em producao (somente leitura)..."
scp scripts/remote-db-backup.cjs "${SERVER}:/tmp/remote-db-backup.cjs"
REMOTE_EXPORT="$(ssh "${SERVER}" "cd /app/.output/server && node /tmp/remote-db-backup.cjs '${STAMP}'")"

echo "Baixando banco..."
scp "${SERVER}:${REMOTE_EXPORT}" "${LOCAL_DB}"

echo "Limpando arquivo temporario remoto..."
ssh "${SERVER}" "rm -f '${REMOTE_EXPORT}' /tmp/remote-db-backup.cjs"

rm -f "${LOCAL_DB}-wal" "${LOCAL_DB}-shm"

echo "Banco local atualizado: ${LOCAL_DB} ($(wc -c < "${LOCAL_DB}") bytes)"
